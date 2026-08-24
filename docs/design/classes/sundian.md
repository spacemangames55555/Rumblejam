# SUNDIAN — RUMBLEJAM CONVERSION (30 skills)

*Code id is `toh_sundian`; display name is Sundian throughout. An earlier
version of this note claimed the id was held at `atlantean` for save safety —
no such id exists in `js/`, and none ever has. Renaming `toh_sundian` would
still break saves, which store the class id; `tools/class_doc_gate.mjs` now
checks this document's class token against the live set.*

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.

---

## CLASS ENGINE — TIDE (fully derived; the code named it)

Of the fourteen classes, this is the only one where the engine, its input,
its consumer and its conversion rate all already exist in shipped code:

- **Drench** is a stack applied to enemies — Water Lash +1, Trident Strike
  +1, Tsunami +2, and Waterlogged Edge makes *every* melee strike apply one
- **Drench (passive)** deepens it: one extra stack per application, and each
  stack slows 3% harder
- **Depth Crush** consumes the stacks
- **Ebb and Flow** declares: *"every drench stack you consume gives 3 Tide
  back"*

I invented nothing here. I only wrote down what the four nodes already
describe between them.

**TIDE, 0–100.** Starts each run at 0.

Feeds:
- **+3 per drench stack consumed** (the code's own number)
- **+1 per drench stack applied**
- **+2 per enemy killed while drenched**

Consumes:
- Riptide **25** · Whirlpool **30** · Tsunami **50**
- Wrath of the Deep **50** · The Drowned Crown **60**

Decays **1/sec** — the slowest decay in the roster, because Tide is a tidal
bank rather than a temperature.

**This is the only engine in the project with a closed loop.** Every other
class generates its resource as a side effect of fighting. The Sundian
*builds* something on the enemies, then harvests it. Apply, deepen, consume,
convert, spend. It is a two-step economy and it is the most mechanically
sophisticated class in the roster by a wide margin.

---

## PORT RULINGS

**1. Drench is a first-class enemy debuff and needs stating.** Stacks cap at
**8** per enemy. Each stack slows 4% base, 7% with the Drench passive. Depth
Crush consumes every stack on every enemy in its 320px area and deals
damage per stack consumed. **A Sundian who has drenched a pack to 8 and then
Depth Crushes is doing the highest single-cast damage in the game**, and
also gaining 24 Tide per enemy. Nothing in the interface says so.

**2. The Regalia tree is six empty nodes and a worn-item system that does not
exist.** Pearl Diadem, Coral Signet, Abyssal Bands, Tidal Talisman,
Moonstone Ward and The Drowned Crown all have zero riders, zero stat mods
and zero effects. Jeweler's Attunement is the tell: *"every regalia you don
draws 35% deeper."* The tree is describing **equippable items**, three of
them on 1500ms cooldowns — a "don" action, not an attack.

Ruling: **regalia are permanent self-buffs.** Casting one dons it; it stays
for the run; it occupies a slot. Jeweler's Attunement multiplies all worn
regalia by 35%. I have authored all six effects. **This is the largest block
of invention in the project — six of thirty skills in one class — and the
whole tree should be reviewed as a design proposal rather than a
conversion.**

**3. Coral Signet has the one surviving hint.** The export notes "reflect
damages attackers reactively," so that one is reconstruction rather than
pure invention. Noted on its block.

**4. Movement, allies, hazards** carry from earlier classes. Tide Step is a
teleport, so it uses Blink's rule — safest reachable point within 200px.

---

## TREE: TIDECALLER

Role read: **the controller and the engine's front half.** Four hazards, two
pulls, the drench deepener, the Tide converter and a capstone that drenches
a whole cone. Nothing here hits hard; everything here sets up Depth Crush.

---

SKILL NAME:           Water Lash
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (circle r30 at target)
RANGE:                range medium (260px)
TARGETS:              uncapped inside r30 (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          low (19)
PACE:                 fast (2200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               drench +1 stack (+1 more with the Drench passive)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy below max drench
                      stacks, so it spreads and tops up rather than
                      over-stacking one target
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +6px application radius every 4th rank
--- identity ---
ENGINE:               feeds +1 per stack applied, and everything it drenches
                      becomes +3 later when Depth Crush harvests it. This is
                      the front of the loop
COST:                 a thirty-pixel application circle at 260px range is
                      almost a single target, so the class's primary drench
                      applicator paints slowly. Building a pack to eight
                      stacks with Water Lash alone takes most of a minute
VISUAL:               a thin whip of water that cracks rather than splashes;
                      the target stays visibly wet
FLAVOR:               Bali taught him that water does not push. It arrives,
                      and it stays, and the pushing is a thing it gets around
                      to later.

SKILL NAME:           Undertow
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (persistent hazard 4000ms)
RANGE:                melee long (140px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 4 per 500ms tick
PACE:                 slow (11000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.6 inside the hazard
DOT:                  hazard tick 4 per 500ms for 4000ms — 32 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (140px)
THREAT:               none
--- growth ---
RANK ADDS:            +1 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               neutral — hazard ticks apply no drench, so this skill
                      is outside the loop entirely. It is control, not economy
COST:                 thirty-two damage over four seconds and it does not
                      drench. In a class whose entire power comes from the
                      drench loop, a slot spent on a hazard that produces no
                      stacks is a slot spent on survival alone
VISUAL:               the floor becomes a visible pull, everything on it
                      drifting slightly toward the low side
FLAVOR:               It is not a current. There is no current. What there is
                      is a place where the water is going somewhere else and
                      has not consulted anybody about the arrangements.

SKILL NAME:           Riptide
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (two-phase — pull r240, then blast r200,
                      at 150px)
RANGE:                range short (150px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 slow (13000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               pull everything within 240px toward the centre, then
                      blast outward in r200
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 300px), gated on 25 Tide
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +15px pull radius and +10px blast radius per
                      rank
--- identity ---
ENGINE:               consumes 25 Tide
COST:                 twelve damage for twenty-five Tide, and it gathers the
                      pack and then scatters it again in the same cast. The
                      pull is exactly what Depth Crush wants and the blast
                      immediately undoes it. **Riptide fights its own class**
                      and the two phases were clearly designed for a human
                      who could choose the moment
VISUAL:               everything leans inward, hangs for a beat, and then goes
                      outward harder than it came
FLAVOR:               The dangerous part of a rip is not the pull. Everyone
                      survives the pull. It is the part afterward, when you
                      have been put somewhere you did not agree to and are
                      out of breath.

SKILL NAME:           Drench
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 3
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
RIDERS:               scene-keyed [declared, not derived] — "your water soaks
                      DEEPER: every drenching applies one more stack, and each
                      stack slows 3% harder"
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +1% additional slow per stack per rank; +1 stack
                      applied per application every 5th rank
--- identity ---
ENGINE:               feeds — doubling the application rate doubles the front
                      of the loop and therefore doubles every Depth Crush
                      harvest. It is the highest-leverage node in the class
COST:                 it produces no damage and no visible effect. A player
                      who has not worked out what drench is for will look at
                      "applies one more stack" and skip it, and then never see
                      the class function
VISUAL:               nothing on him; drenched enemies are visibly wetter and
                      slower, and the stacks read as darkening on the sprite
FLAVOR:               Soaked is a threshold, not a quantity. He has spent his
                      life finding out how far past it a thing can be taken.

SKILL NAME:           Tidal Spout
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r95 at 280px)
RANGE:                range medium (280px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 medium (7000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               knockback 130px
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 280px
THREAT:               none
--- growth ---
RANK ADDS:            +4 damage; +15px knockback every 3rd rank; +6px radius
                      every 3rd rank
--- identity ---
ENGINE:               neutral — no drench, so outside the loop
COST:                 a hundred and thirty pixels of knockback on a class
                      that needs enemies gathered for Depth Crush. Along with
                      Riptide's blast and Breaker Sweep's shove, the Sundian
                      has three skills that scatter the pack his best skill
                      needs assembled
VISUAL:               a column of water erupting upward from the floor,
                      throwing everything in the circle off its feet
FLAVOR:               Pressure looks for a route. It always finds one and it
                      is never the route anyone would have chosen for it.

SKILL NAME:           Mist Veil
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 5
TYPE:                 buff
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (16000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 6000ms — blockChance +0.30, blockReduction 0.70
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (150px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% block chance per rank; +400ms duration every 4th
                      rank
--- identity ---
ENGINE:               neutral
COST:                 thirty percent block chance is the highest in the
                      roster and it lasts six seconds in every sixteen. It is
                      strong, brief, and pure variance — three blocks in a row
                      or none, and no way to tell which run you are in
VISUAL:               a close bank of white mist that does not travel with him
                      so much as re-form around him
FLAVOR:               He is not hidden. Mist does not hide anyone. It removes
                      everyone's confidence about distance, which is
                      considerably more useful and much harder to explain.

SKILL NAME:           Depth Crush
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at target)
RANGE:                range medium (320px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (9 base) — up to 121 per enemy at 8 stacks
PACE:                 slow (9000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               CONSUMES every drench stack on every enemy in the area,
                      dealing 14 per stack consumed on top of the base 9
                      (ruling 1)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY when total drench stacks within 320px
                      exceeds 12 — it waits for the harvest to be worth taking
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage per stack consumed; +2 base damage per rank
--- identity ---
ENGINE:               feeds enormously — +3 Tide per stack consumed, so a
                      pack of five at eight stacks is 120 Tide, capped at
                      100. **A single well-timed Depth Crush fills the bar
                      outright**
COST:                 nine damage if nothing is drenched, which is what the
                      tooltip will show and what a new player will judge it
                      on. It is the single highest-ceiling skill in the game
                      and it looks like the worst node in the class
VISUAL:               nothing is thrown. Every drenched enemy in the area is
                      simply crushed inward at once, and the water that was
                      on them is gone afterward
FLAVOR:               Eleven kilometres down there is nothing but the weight
                      of everything above it. That is not a force he
                      generates. It is a fact he has learned how to point at.

> **The class in one node.** Water Lash and Trident Strike and Waterlogged
> Edge paint the pack; the Drench passive doubles the paint; Depth Crush
> harvests it; Ebb and Flow converts the harvest to Tide; Tide pays for
> Tsunami and Wrath of the Deep. Five nodes across two trees form a complete
> economy, and no description mentions any of the others.

SKILL NAME:           Whirlpool
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (persistent hazard 4500ms)
RANGE:                range short (160px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 8 per 500ms tick
PACE:                 slow (14000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.75 inside the hazard
DOT:                  hazard tick 8 per 500ms for 4500ms — 72 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 160px, gated on 30 Tide
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 30 Tide and produces no drench — it spends the
                      economy without feeding it, which makes it the most
                      expensive control skill in the class
COST:                 thirty Tide is a Depth Crush harvest's worth, spent on
                      seventy-two damage and a mild slow, anchored to a spot.
                      A Sundian running Whirlpool is a Sundian who cannot
                      afford Tsunami
VISUAL:               a slow deep rotation in the floor with a visible centre;
                      things caught in it circle before they sink
FLAVOR:               It does not drag anything down. It simply keeps
                      offering the same few metres of water and eventually
                      something accepts.

SKILL NAME:           Ebb and Flow
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 8
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
RIDERS:               scene-keyed [declared, not derived] — "what the sea
                      takes, the sea returns: every drench stack you consume
                      gives 3 Tide back"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +1 Tide per stack consumed per rank
--- identity ---
ENGINE:               this node IS the conversion. Every number in the Tide
                      system above was derived from its declared text, and
                      without it slotted the class has an input and a
                      consumer and no economy at all
COST:                 it produces nothing on its own and it is at tier 9,
                      which means the player must have already committed to
                      the drench loop across two trees before this node makes
                      any of it pay. It is the last piece of a five-node
                      machine and the one that turns it on
VISUAL:               nothing visible; the Tide bar jumps when Depth Crush
                      lands
FLAVOR:               The tide does not go out. Nothing leaves. It is
                      elsewhere for a while and the arrangement has never once
                      failed to reverse itself.

SKILL NAME:           Tsunami
CLASS / TREE / TIER:  Sundian / Tidecaller / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (110° total)
RANGE:                range medium (320px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          high (40)
PACE:                 very slow (60000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               knockback 170px; drench +2 stacks (+2 more with the
                      Drench passive) to every enemy in the cone
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 320px, gated on 50 Tide
THREAT:               high
--- growth ---
RANK ADDS:            +8 damage; +1 drench stack every 4th rank; +6° cone
                      width every 4th rank
--- identity ---
ENGINE:               consumes 50 Tide and then immediately refills it — four
                      stacks on eight enemies is thirty-two stacks waiting for
                      Depth Crush, which is ninety-six Tide on harvest. **It
                      is the only capstone in the roster that pays for itself
                      twice over**
COST:                 a hundred and seventy pixels of knockback, which throws
                      the pack it just drenched out of Depth Crush's 320px
                      range. The two halves of the Sundian's best combination
                      are in direct physical conflict, and the automation
                      cannot solve it — only a delay before harvesting can
VISUAL:               a wall of water crossing the whole cone at head height;
                      everything it passes is drenched, knocked flat, and
                      still wet when it gets up
FLAVOR:               The wave is not the event. The wave is what the event
                      looks like from a beach. He has been out past the break
                      when one went under him and there was nothing to see at
                      all.

---

## TREE: BLADE

Role read: **the melee DPS and the drench engine's fastest applicator.**
Waterlogged Edge makes every melee strike drench, which turns this entire
tree into the front half of the loop. It is also where the class's only
sustain and only teleport live.

---

SKILL NAME:           Trident Strike
CLASS / TREE / TIER:  Sundian / Blade / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r78)
RANGE:                melee short (78px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (19)
PACE:                 fast (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               drench +1 stack (+1 more with the Drench passive)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (78px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 target every 5th rank
--- identity ---
ENGINE:               feeds +1 per stack applied — at 2000ms across three
                      targets it is the fastest drench applicator in the class
                      and the real front of the loop
COST:                 seventy-eight pixels. The Sundian's best stack
                      generation requires him inside the pack, and his best
                      harvest — Depth Crush — is a 320px ranged skill. The
                      class wants to be in two places
VISUAL:               three points entering together and leaving wet; the
                      water on the trident never runs off
FLAVOR:               Three tines because two would let a thing turn. It is
                      not a fishing tool and has never been a fishing tool and
                      he is tired of the assumption.

SKILL NAME:           Waterlogged Edge
CLASS / TREE / TIER:  Sundian / Blade / tier_code 1
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
RIDERS:               scene-keyed [declared, not derived] — "the blade never
                      dries: EVERY melee strike you land leaves a drench stack
                      behind it"
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +1 stack applied every 4th rank (so at rank 4 every
                      melee strike drenches twice)
--- identity ---
ENGINE:               feeds massively — it converts nine otherwise
                      loop-neutral melee skills into stack applicators at
                      once. With the Drench passive also slotted, every melee
                      strike applies two stacks to everything it touches
COST:                 it does nothing for the Tidecaller or Regalia trees and
                      nothing at all in a ranged build. It is a tier-2 node
                      whose value is entirely a function of how many melee
                      skills the player slots, and the interface gives no
                      indication of that relationship
VISUAL:               the blade is visibly wet at all times and the wet does
                      not thin with use
FLAVOR:               It has not been dry since he took it out of the water.
                      He has tried. He has stopped trying and has started
                      considering it a feature.

SKILL NAME:           Crashing Blow
CLASS / TREE / TIER:  Sundian / Blade / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r82)
RANGE:                melee long (82px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (16) — 26 against drenched targets (×1.6)
PACE:                 medium (6000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               ×1.6 against any target currently DRENCHED, resolved
                      per target
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (82px), preferring drenched targets
THREAT:               some
--- growth ---
RANK ADDS:            +3 base damage (the ×1.6 does not scale, so a rank-10
                      Crashing Blow hits drenched targets for 74)
--- identity ---
ENGINE:               feeds via Waterlogged Edge, and it is the only skill in
                      the class that *rewards* drench without consuming it —
                      so it can run alongside Depth Crush rather than
                      competing for the stacks
COST:                 sixteen damage against anything dry, which in the
                      opening seconds of a run is everything. It is the second
                      of two skills whose printed number is a lie in both
                      directions depending on setup
VISUAL:               a heavy downward blow; against a wet target the impact
                      throws a visible sheet of water outward
FLAVOR:               Wet stone splits. Dry stone chips. There is a great deal
                      of quarry work behind that sentence and none of it was
                      his.

SKILL NAME:           Tide Step
CLASS / TREE / TIER:  Sundian / Blade / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r90 hazard at the origin) + teleport
RANGE:                melee long (90px hazard; 200px teleport)
TARGETS:              uncapped in the hazard (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          none (0 direct) — 2 per 500ms tick
PACE:                 slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               the Sundian teleports 200px, leaving the hazard behind
                      at the origin; slow ×0.6 inside it. Destination is the
                      safest reachable point (ruling 4)
DOT:                  ground tick 2 per 500ms for 3500ms
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px)
THREAT:               none
--- growth ---
RANK ADDS:            +1 damage per tick; +20px teleport range every 4th rank;
                      +1s hazard duration every 4th rank
--- identity ---
ENGINE:               neutral — the hazard applies no drench
COST:                 two damage a tick is the smallest number in the class,
                      and the teleport is the point. It is the only escape the
                      Sundian owns, and every use of it puts 200px between him
                      and the pack he has spent the fight drenching
VISUAL:               he goes into the floor and comes out of it somewhere
                      else; where he left, the water stays and keeps working
FLAVOR:               There is more connection between two bodies of water
                      than there is between two pieces of ground. He finds
                      that obvious and everyone else finds it alarming.

SKILL NAME:           Coral Guard
CLASS / TREE / TIER:  Sundian / Blade / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (14000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               absorb shield 40 for 6000ms
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (130px)
THREAT:               none
--- growth ---
RANK ADDS:            +12 absorb per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 forty absorb is the smallest shield in the roster and
                      it expires whether used or not. On a breach trigger it
                      will be spent on false alarms several times a minute,
                      and it is the only shield the class has
VISUAL:               plates of pale living coral close over the forearms and
                      chest and crack where they are struck
FLAVOR:               It is alive and he has never been comfortable with what
                      that implies about the arrangement, and he wears it
                      anyway.

SKILL NAME:           Breaker Sweep
CLASS / TREE / TIER:  Sundian / Blade / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (120° total)
RANGE:                melee long (100px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 medium (7000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 150px
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 100px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +15px knockback every 3rd rank; +6° cone
                      width every 4th rank
--- identity ---
ENGINE:               feeds via Waterlogged Edge — a 120° fan drenching four
                      enemies at once is the widest single application in the
                      class
COST:                 and then it throws all four of them 150px away. It is
                      simultaneously the best drench applicator and the worst
                      thing for the harvest, and it is the third knockback in
                      a class that needs enemies gathered. **The Sundian has
                      four scatter effects and one gather** and the tree does
                      not warn anybody
VISUAL:               a wide low sweep that carries a wall of water with it;
                      everything in the arc goes back soaked
FLAVOR:               A breaker is water that has run out of depth. It has
                      nowhere left to go but forward and up and over, and
                      nothing standing in front of it has ever found that
                      negotiable.

SKILL NAME:           Abyssal Weight
CLASS / TREE / TIER:  Sundian / Blade / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r80)
RANGE:                melee long (80px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          low (18)
PACE:                 slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.35 for 3000ms — the hardest slow in the class
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (80px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +300ms slow every 3rd rank; +1 target every
                      4th rank
--- identity ---
ENGINE:               feeds via Waterlogged Edge
COST:                 eighteen damage on an eight-second cooldown. Its value
                      is the slow, and it is the one skill in the class that
                      keeps the pack *in place* for Depth Crush rather than
                      moving it — which makes it far more important than its
                      damage number suggests
VISUAL:               nothing is thrown; everything within four paces simply
                      becomes heavier and lower and slower
FLAVOR:               Weight is not a thing water has. It is a thing water
                      accumulates on the way down, and there is a very long
                      way down.

SKILL NAME:           Twin Currents
CLASS / TREE / TIER:  Sundian / Blade / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r74)
RANGE:                melee short (74px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (11 × 2 pulses = 22)
PACE:                 medium (4800ms)
DOMAIN:               physical
--- effects ---
RIDERS:               2 pulses 150ms apart, each rolling its own hits
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (74px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per pulse; +1 pulse every 6th rank
--- identity ---
ENGINE:               feeds twice via Waterlogged Edge — two pulses is two
                      drench applications per cast, which makes this the most
                      stack-efficient node in the tree despite its damage
COST:                 twenty-two damage over 4800ms is poor for tier 8 read as
                      an attack. Read as a stack applicator it is excellent,
                      and nothing in its description points at that reading
VISUAL:               two strikes from opposite sides, arriving as one motion,
                      each carrying its own sheet of water
FLAVOR:               Two currents meeting do not cancel. That is a thing
                      people expect and it has never once happened. They
                      produce a third thing and the third thing is worse.

SKILL NAME:           Drowning Grasp
CLASS / TREE / TIER:  Sundian / Blade / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at target)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (16)
PACE:                 slow (10000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               root 1600ms on the nearest enemy; heals the Sundian 50%
                      of the drain damage dealt
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (65%), falling back to
                      DENSEST_CLUSTER within 200px at full health
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage (the 50% drain ratio does not scale)
--- identity ---
ENGINE:               neutral — an instant-at-range hit, so Waterlogged Edge
                      does not apply
COST:                 eight health back per enemy struck, and it is the only
                      healing in thirty skills. The Sundian's entire sustain
                      is one tier-9 node with a ten-second cooldown, and if
                      it is not slotted he has no recovery of any kind
VISUAL:               water closes over the heads of everything in the area
                      and does not fall; something comes back along it to him
FLAVOR:               Drowning is not violent. That is the part nobody
                      believes until they have watched one. It is quiet, and
                      it takes a while, and the person doing it is usually
                      quite calm.

SKILL NAME:           Wrath of the Deep
CLASS / TREE / TIER:  Sundian / Blade / tier_code 9
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
DOMAIN:               physical
--- effects ---
RIDERS:               form 10000ms — attackSpeedMult +0.25, damageMult +0.10
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 150px), gated on 50 Tide
THREAT:               none
--- growth ---
RANK ADDS:            +5% attack speed and +3% damage per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes 50 Tide and then refills it — +25% attack speed
                      with Waterlogged Edge running means 25% more drench
                      applications, which becomes 25% more Tide on the next
                      harvest. It is a capstone that accelerates the loop
                      rather than replacing it
COST:                 ten seconds for sixty, and its damage multiplier is the
                      smallest of any capstone in the roster at +10%. Its case
                      is entirely the attack speed and what that does to the
                      drench economy, which is a subtle argument for a tier-10
                      node to be making
VISUAL:               nothing about him changes shape; the water around him
                      stops behaving like water and starts moving on his beat
FLAVOR:               There is no wrath down there. There is nothing down
                      there at all, in the sense people mean. What he is
                      borrowing is the absence of any reason to hurry.

---

## TREE: REGALIA

Role read: **a worn-item system that does not exist in code.** Six of these
ten nodes have no effect of any kind, and Jeweler's Attunement's declared
text — *"every regalia you don draws 35% deeper"* — is the only evidence of
what the tree was meant to be. **I have authored all six.** Review this tree
as a design proposal, not a conversion.

---

SKILL NAME:           Signet Flare
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (19)
PACE:                 fast (2200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (300px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; at rank 7 it pierces 1 additional enemy
--- identity ---
ENGINE:               neutral — no drench, so the Regalia tree's one attack
                      sits outside the class's economy entirely
COST:                 nineteen damage, single target, and it is the only
                      damage in ten nodes. A pure Regalia Sundian has one
                      attack and nine pieces of jewellery, which is a real
                      build and a very slow one
VISUAL:               a hard bright point leaving the ring on his hand,
                      arriving without an arc
FLAVOR:               The ring was not made for this. Nothing in the regalia
                      was made for this. He has found that the drowned
                      jewellers built better than their commissions required.

SKILL NAME:           Pearl Diadem
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 1
TYPE:                 active (worn — see ruling 2)
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1500ms — a "don" action, not an attack)
DOMAIN:               mental
--- effects ---
RIDERS:               AUTHORED — worn permanently once donned: maxHPMult
                      +0.25, and all healing received +30%
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY at the start of a run; donned once and
                      then held
THREAT:               none
--- growth ---
RANK ADDS:            +5% max HP and +6% healing received per rank
--- identity ---
ENGINE:               neutral
COST:                 it is a permanent stat with no downside occupying one of
                      eight slots. On a class with exactly one healing skill,
                      the +30% healing half is close to worthless and the
                      max-HP half is doing all the work
VISUAL:               a fine circlet of small pearls, worn low on the brow;
                      it is not decorative and it is not subtle
FLAVOR:               A pearl is an injury that was handled well. There is a
                      whole philosophy in the archipelago built on that
                      sentence and he was raised inside it.

> **AUTHORED FROM NOTHING.** Zero riders, zero stat mods in code. Effect
> written from the name and the tier.

SKILL NAME:           Coral Signet
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 2
TYPE:                 active (worn)
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              1 (the attacker, reactively)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1500ms — a "don" action)
DOMAIN:               mental
--- effects ---
RIDERS:               RECONSTRUCTED — the export notes "reflect damages
                      attackers reactively," so: worn permanently, reflectPct
                      0.30
DOT:                  none
AFFECTS:              enemies, self
--- automation ---
TRIGGER:              COOLDOWN_READY at the start of a run; the reflect then
                      fires on ON_DAMAGE_TAKEN
THREAT:               none
--- growth ---
RANK ADDS:            +4% reflect per rank
--- identity ---
ENGINE:               neutral
COST:                 thirty percent returned requires taking the other
                      seventy, on a class whose only mitigation is a
                      six-second block window and a forty-point shield. It is
                      a good number attached to a body that cannot afford to
                      collect it
VISUAL:               a rough band of red coral on the middle finger; it
                      brightens on each impact
FLAVOR:               Coral cuts on the way past. It does not intend to and
                      it does not stop, and anyone who has swum a reef in a
                      hurry knows exactly what he means by wearing it.

> **RECONSTRUCTED, not invented from nothing** — the export's reflect note
> is the one surviving hint in this tree.

SKILL NAME:           Abyssal Bands
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 3
TYPE:                 active (worn)
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1500ms — a "don" action)
DOMAIN:               mental
--- effects ---
RIDERS:               AUTHORED — worn permanently: damageReduction +0.20,
                      moveSpeedMult −0.10
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY at the start of a run
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage reduction per rank; the −10% move speed does
                      NOT scale down
--- identity ---
ENGINE:               neutral
COST:                 it is the only real mitigation the Sundian can own and
                      it costs him ten percent of the one thing RumbleJam
                      actually tests. I gave it the drawback deliberately —
                      six permanent no-downside stat nodes in one tree would
                      make the Regalia build strictly correct
VISUAL:               heavy dark bands at both wrists, deeply engraved,
                      visibly heavier than they should be
FLAVOR:               They were weights first. Somebody at some point decided
                      they should also be beautiful and did not remove any of
                      the weight to make room.

> **AUTHORED FROM NOTHING.** The drawback is mine and it is the balance
> lever for the whole tree.

SKILL NAME:           Jeweler's Attunement
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 4
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
DOMAIN:               mental
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "you learn what
                      the drowned jewelers knew: every regalia you don draws
                      35% deeper"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +6% to all worn regalia effects per rank
--- identity ---
ENGINE:               neutral
COST:                 it multiplies six nodes that have no effects in shipped
                      code. **This node is the only evidence that the Regalia
                      tree was ever meant to be a worn-item system**, and
                      every effect I authored above was written to give it
                      something to multiply
VISUAL:               nothing on him; each piece of regalia visibly sits
                      differently, more settled
FLAVOR:               They are all still down there. Their work is on his
                      hands and their names are on nothing at all, and he has
                      taken the trouble to learn several of them.

SKILL NAME:           Tidal Talisman
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 5
TYPE:                 active (worn)
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (20000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               AUTHORED — worn permanently: +2 Tide per second, and
                      drench stacks on enemies last 50% longer before decaying
DOT:                  none
AFFECTS:              self, enemies
--- automation ---
TRIGGER:              COOLDOWN_READY at the start of a run
THREAT:               none
--- growth ---
RANK ADDS:            +0.5 Tide per second and +8% drench duration per rank
--- identity ---
ENGINE:               feeds — it is the only passive Tide generation in the
                      class, and the drench-duration half means the harvest
                      window is wider, which is worth more than the Tide
COST:                 it produces no damage and no defence, and it is only
                      worth a slot in a build that already runs the drench
                      loop across two other trees. A Regalia-only Sundian
                      gains almost nothing from it
VISUAL:               a small carved stone on a cord at the throat, wet at all
                      times regardless of the weather
FLAVOR:               It knows what the tide is doing. Not predicts —
                      knows — and he stopped questioning the distinction the
                      third time it was right about something it should not
                      have been able to see.

> **AUTHORED FROM NOTHING.** I tied this one to the Tide engine deliberately,
> so the Regalia tree has at least one node that talks to the rest of the
> class.

SKILL NAME:           Votive Idol
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r130 at caster, persistent 7000ms)
RANGE:                melee long (130px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (18000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  heals 4 per 700ms for 7000ms — 40 per friendly who stays
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 75% within
                      130px
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +1s duration every 4th rank;
                      +8px radius every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 forty health per friendly over seven seconds, anchored
                      where he placed it, on a class with a 200px teleport and
                      four knockbacks. It is the Sundian's only group
                      contribution and he will not be standing in it
VISUAL:               a small carved figure set down on the floor; the ground
                      inside its radius is faintly luminous
FLAVOR:               He does not pray to it and it is not a god. It is a
                      receipt for a promise somebody made a long time ago and
                      it is still, apparently, being honoured.

SKILL NAME:           Drowned Man's Curse
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at target, r140)
RANGE:                range medium (300px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (12000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.55 for 3000ms to everything in r140; weaken 25%
                      for 4000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +400ms on both riders and +8px radius per rank; +2%
                      weaken every 3rd rank (not damage — it deals none at any
                      rank)
--- identity ---
ENGINE:               neutral — applies no drench, which is a missed
                      opportunity the code did not take and I have not
                      invented my way into
COST:                 zero damage on a twelve-second cooldown. Both effects
                      are strong and both are invisible, and it is the one
                      node in this tree that would most obviously have wanted
                      to apply drench and does not
VISUAL:               nothing arrives. Everything in the area simply becomes
                      slower and less able, as though something has been
                      remembered at them
FLAVOR:               The dead do not curse anybody. They have no opinions
                      whatsoever. What they have is a great deal of unfinished
                      business and a very poor sense of whose it was.

SKILL NAME:           Moonstone Ward
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 8
TYPE:                 active (worn)
AXIS POSITION:        9 (of 10)
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
RIDERS:               AUTHORED — worn permanently: a 50-point absorb shield
                      that self-refreshes every 8000ms once fully depleted,
                      and immunity to the first stun or root every 10000ms
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY at the start of a run; the shield then
                      maintains itself
THREAT:               none
--- growth ---
RANK ADDS:            +12 absorb per rank; −500ms refresh interval every 4th
                      rank, floor 5000ms
--- identity ---
ENGINE:               neutral
COST:                 a self-refreshing shield is the strongest defensive
                      effect I have authored anywhere in this project, and it
                      is at tier 9 of a tree with nothing else defensive in
                      it. If any of my six Regalia inventions needs cutting
                      down, it is this one
VISUAL:               a pale translucent stone at the collar; when the shield
                      re-forms it does so visibly, from the stone outward
FLAVOR:               It goes cloudy before it breaks and clears again
                      afterward, and he has learned to check it the way other
                      people check a watch.

> **AUTHORED FROM NOTHING**, and flagged as the most powerful thing I have
> invented in fourteen classes. Treat it as a proposal to argue with.

SKILL NAME:           The Drowned Crown
CLASS / TREE / TIER:  Sundian / Regalia / tier_code 9
TYPE:                 active (worn)
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (60000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               AUTHORED — for 12000ms, every worn regalia's effect is
                      DOUBLED, and every drench stack applied during the
                      window counts twice for Depth Crush's harvest
DOT:                  none
AFFECTS:              self, enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (7+ within 300px), gated on 60 Tide
THREAT:               none
--- growth ---
RANK ADDS:            +500ms duration per rank; +10% to the doubling every 5th
                      rank (so at rank 5 regalia are ×2.1)
--- identity ---
ENGINE:               consumes 60 Tide and then floods it — double-counted
                      drench during the window means a Depth Crush landing
                      immediately afterward returns roughly double the Tide it
                      normally would. It is the loop's overdrive
COST:                 sixty seconds and sixty Tide, and its value is a strict
                      function of how many regalia are worn. In a build with
                      two regalia it is a small buff on a minute-long
                      cooldown; in a build with five it is the strongest
                      window in the class. **It is the only capstone in the
                      roster whose power depends on the rest of the loadout**
VISUAL:               a heavy circlet of blackened silver and old pearl, worn
                      over the diadem rather than instead of it; every other
                      piece he wears brightens under it
FLAVOR:               It was not his. It belonged to somebody whose city is
                      four hundred metres down and whose name is on nothing.
                      He wears it because somebody has to and because the
                      alternative was leaving it where it was.

> **AUTHORED FROM NOTHING.** Written as a multiplier on the rest of the tree
> rather than a standalone effect, so that the Regalia build has a payoff
> shaped like the tree it sits at the top of.
