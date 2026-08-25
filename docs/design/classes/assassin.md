# ASSASSIN — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Shadow (doc).**

**Tree names — built names win.** Traps→Killbox, Shadow→Shadow, Marksman→Range


**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least **3** nodes fast-or-better per tree,
at most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 6.67/sec on a spread build — IN BAND.**

**Ruling 6 (rider duration under cooldown) — APPLIED.** 7 rider durations cut across 7 skills, each to ~70% of its skill's new cooldown and each annotated inline with what it
was. Nothing fell under the 500ms floor, so no rider was deleted outright.

**Exempt:** Poisoned Stars held — its `RIDERS` line restates the stacking DoT in `DOT:`, and stacking DoTs are exempt.

**Grandfathered:** Flash Trap — rider 3500ms is 88% of its 4000ms cooldown, over roster ruling 6's 70% target and under the cooldown. Accepted pending playtest, not a defect.

**Grandfathered:** Smoke Bomb — rider 3200ms is 80% of its 4000ms cooldown, over roster ruling 6's 70% target and under the cooldown. Accepted pending playtest, not a defect.

**Outstanding:** the concealment feed has no built counterpart and is new `js/` work.

---

## THE STRUCTURAL PROBLEM, AND THE RULING

ToH's stealth breaks the instant the player attacks. That is correct for a
game where a human chooses when to strike. In RumbleJam every owned skill
fires on its own trigger, continuously — so Cloak of Shadows' twenty seconds
of stealth would end on the next tick, every time, forever. Three of the
Shadow tree's ten nodes would be unusable and the class's identity would be
gone.

**RULING: stealth becomes intermittent rather than binary.** While a stealth
buff is running, attacking drops the Assassin out of concealment for
**2000ms**, after which he re-enters automatically if the buff still has
time left. Cloak of Shadows is therefore twenty seconds of *flickering* — in
and out, several times — and every strike made from concealment keeps the
code's own **×1.8 stealthBonus**.

This turns the ×1.8 from a one-shot opener into a rhythm, makes Shadow Dance
(which removes the break entirely) a genuine capstone rather than a
technicality, and is the only version of this class that functions in an
auto-fire game. It is a large change and it is the whole reason the
Assassin ports at all.

---

## CLASS ENGINE — SHADOW

**SHADOW, 0–100.** Starts each run at 0.

Feeds:
- **+5 per second while concealed** — the class is paid for being unseen
- **+4 per second per armed device standing** (traps waiting count as
  preparation)
- **+8 per stealthBonus strike landed**

Consumes:
- Cloak of Shadows **30** · Vanish **25** · Shadow Dance **60**
- Minefield **50** · Rain of Steel **40**

Decays **2/sec while visible and with no devices armed.**

An Assassin standing in the open, traps spent, fighting straightforwardly,
earns nothing and bleeds. Every other class in the roster generates its
engine *by fighting*. This one generates it by **not having started yet**,
which is the only engine in the project that rewards the player for the
seconds before the violence.

---

## PORT RULINGS

**1. Devices are a standing pool.** Traps arm and wait. Base **3 armed at
once**; Trap Mastery adds 1 (declared). Ruling: a trap skill will not fire
if the pool is full, and Remote Detonation empties it. Armed devices are
Shadow income, so an Assassin who never detonates is richer and weaker —
which is the correct tension for a trapper.

**2. Trap Mastery's numbers are the code's.** Declared: devices arm 40%
faster, hit 25% harder, +1 armed. Kept verbatim.

**3. Four Marksman nodes have no riders and I have authored them.**
Ensnaring Shot, Piercing Strikes, Poisoned Stars and Crippling Shot are all
11–13 damage single-target on 7–9 second cooldowns with nothing else — four
names promising four mechanics the code does not deliver. Same pathology as
the Samurai's Bow tree. Each flagged on its block.

**4. Confusion** uses the Bard's definition: the target attacks other
enemies and its threat on the player drops to zero. Flash Trap and Smoke
Bomb both use the code's own 85% / ~3.5s values.

**5. Poisoned Edge is a bleed-equivalent** — declared as "every strike
leaves a festering wound," scene-keyed. Treated like the Samurai's Razor's
Edge: applies to every damaging skill, magnitude in MainScene.

**6. Movement, allies, hazards** carry from earlier classes.

---

## TREE: KILLBOX  (was Traps in the source conversion)

Role read: **the zone controller, and the roster's only pre-placement
class.** Nine devices and a detonator. It is the tree that decides where the
swarm is allowed to walk, and it is the only tree in the game whose damage
is committed *before* the enemies arrive.

---

SKILL NAME:           Blade Trap
CLASS / TREE / TIER:  assassin / Killbox / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (device: trigger r70, burst on spring)
RANGE:                melee short (70px)
TARGETS:              springs on the first enemy; the burst is uncapped
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the device pool being under cap
THREAT:               none — a sprung trap draws no attention to the caster
--- growth ---
RANK ADDS:            +4 damage; +6px trigger radius every 4th rank
--- identity ---
ENGINE:               feeds +4/sec while armed and waiting
COST:                 it deals nothing until something walks onto it, and the
                      Assassin does not control where things walk. Placed on
                      an empty floor it is a slot generating Shadow and no
                      damage, which is either patience or a wasted cooldown
                      depending on the next ten seconds
VISUAL:               a low flat plate, barely visible; when it goes, the
                      blades come up rather than out
FLAVOR:               The first one he built took four hours and a great deal
                      of swearing. This one takes three seconds and he is not
                      sure the trade was in his favour.

SKILL NAME:           Snare Trap
CLASS / TREE / TIER:  assassin / Killbox / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (device: trigger r70)
RANGE:                melee short (70px)
TARGETS:              springs on the first enemy only
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               root 840ms on whatever springs it
                      — roster ruling 6: 2800ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the pool being under cap
THREAT:               none
--- growth ---
RANK ADDS:            +300ms root and +5px trigger radius per rank (not
                      damage — it deals none and should not start)
--- identity ---
ENGINE:               feeds +4/sec while armed
COST:                 one enemy, held for under three seconds, from a device
                      that occupies one of only three or four armed slots.
                      In a swarm of thirty it removes 3% of the problem for
                      3% of the fight
VISUAL:               a loop of dark cord that does not exist until it does,
                      snapping taut around one leg
FLAVOR:               Dubai has no woods to learn this in. He learned it from
                      a man who had, and who was very specific about the
                      knot and unwilling to say why.

SKILL NAME:           Trap Mastery
CLASS / TREE / TIER:  assassin / Killbox / tier_code 2
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
RIDERS:               scene-keyed [declared, not derived] — "practiced hands:
                      devices arm 40% faster, hit 25% harder, and 1 more can
                      wait armed at once"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +8% device damage and +6% arm speed per rank; +1 armed
                      device every 5th rank
--- identity ---
ENGINE:               feeds heavily — every extra armed slot is another
                      +4/sec, so this node raises the Assassin's income
                      ceiling as well as his output
COST:                 it does nothing at all for the Shadow or Marksman
                      trees, and it is the tier-3 node, so a trapper has
                      committed two slots to devices before this becomes
                      worth anything. In a hybrid build it is dead weight
VISUAL:               the placement animation shortens visibly — he stops
                      crouching and starts simply dropping things
FLAVOR:               Twenty years of doing something with your hands does
                      not make you faster at it. It makes you stop performing
                      the parts that were never load-bearing.

SKILL NAME:           Toxic Trap
CLASS / TREE / TIER:  assassin / Killbox / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (device; zone DoT on spring)
RANGE:                melee short (70px)
TARGETS:              uncapped in the zone (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          low (6 direct) — the zone is where the damage lives
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               leaves a lingering poison zone when sprung
DOT:                  zone DoT for the zone's duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the pool being under cap
THREAT:               none
--- growth ---
RANK ADDS:            +2 direct damage; +1 zone damage per tick every 2nd
                      rank; +1s zone duration every 4th rank
--- identity ---
ENGINE:               feeds +4/sec while armed
COST:                 six direct damage. Everything it is worth is in a zone
                      that appears only after something has already walked
                      into it, which means it punishes the second enemy
                      through and not the first
VISUAL:               a small glass ampoule under a pressure plate; the
                      spring is quiet and the cloud that follows is not
FLAVOR:               He does not carry the antidote. He has been asked about
                      this and has said that carrying it would imply an
                      expectation of accidents.

SKILL NAME:           Flash Trap
CLASS / TREE / TIER:  assassin / Killbox / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (device: trigger r80)
RANGE:                melee long (80px)
TARGETS:              springs on the first enemy
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               CONFUSION 85% for 3500ms on the springer (ruling 4) —
                      it turns on the nearest enemy and stops seeing the
                      Assassin entirely
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the pool being under cap
THREAT:               none — it is a threat *removal*, on a delay
--- growth ---
RANK ADDS:            +400ms confusion and +5px trigger radius per rank; at
                      rank 8 it confuses a second enemy within 80px
--- identity ---
ENGINE:               feeds +4/sec while armed
COST:                 zero damage and one target. A confused enemy is not a
                      dead enemy — it is an enemy the Assassin has borrowed
                      for three and a half seconds and will have to deal with
                      afterward
VISUAL:               a white crack with no sound; the enemy that triggered
                      it stands very still and then turns the wrong way
FLAVOR:               Not blinding. Blinding is permanent and he has never
                      needed permanent. He needs about three seconds of
                      somebody being sincerely mistaken.

SKILL NAME:           Explosive Trap
CLASS / TREE / TIER:  assassin / Killbox / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (device: trigger r80, burst r130)
RANGE:                melee long (80px)
TARGETS:              uncapped in the burst (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          medium (34)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the pool being under cap
THREAT:               none
--- growth ---
RANK ADDS:            +6 damage; +8px burst radius every 3rd rank
--- identity ---
ENGINE:               feeds +4/sec while armed
COST:                 an 80px trigger with a 130px burst means it goes off
                      when the first enemy arrives, not when the pack does.
                      It is the tree's best damage and it will routinely
                      spend 34 damage on one scout — which is what Remote
                      Detonation two tiers up exists to fix
VISUAL:               a shaped charge, small and deliberate; the burst is
                      wider than the device by a factor of six
FLAVOR:               The trick is not the explosive. Anyone can obtain
                      explosive. The trick is the part that decides when.

SKILL NAME:           Frost Trap
CLASS / TREE / TIER:  assassin / Killbox / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (device: trigger r70, field r120 for
                      4500ms)
RANGE:                melee short (70px)
TARGETS:              uncapped in the field (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.55 to everything inside the field for 2800ms
                      — roster ruling 6: 4500ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the pool being under cap
THREAT:               none
--- growth ---
RANK ADDS:            +500ms field duration and +6px field radius per rank
                      (not damage — it deals none at any rank)
--- identity ---
ENGINE:               feeds +4/sec while armed
COST:                 zero damage, but it is the only trap that affects the
                      whole pack rather than the one that sprang it, which
                      makes it the best device in the tree and the one whose
                      value is least visible on a damage meter
VISUAL:               the plate cracks and the cold comes up rather than out
                      — a low field with a hard edge
FLAVOR:               Cold in Dubai is a manufactured thing and always has
                      been. He has never found that ironic. He has found it
                      instructive.

SKILL NAME:           Remote Detonation
CLASS / TREE / TIER:  assassin / Killbox / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self (command)
SHAPE:                none — every armed device fires where it stands
RANGE:                n/a
TARGETS:              whatever each fired payload catches
--- output ---
DAMAGE TIER:          none (0) — it deals nothing itself
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               each device applies its own payload — bursts, roots,
                      confusions, fields
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ armed devices each have 2+
                      enemies within their burst radius — it waits for the
                      pack to be standing on the field
THREAT:               none
--- growth ---
RANK ADDS:            +10% to all detonated payload damage per rank; −400ms
                      cooldown every 5th rank, floor 3000ms
--- identity ---
ENGINE:               consumes indirectly — it empties the device pool, which
                      cuts the +4/sec income to zero until the traps rearm.
                      Detonating is spending the bank
COST:                 it does nothing on its own and it does nothing at all
                      in a build with fewer than three traps slotted. It is
                      the node that turns the Traps tree from passive
                      furniture into a burst class, and it costs a fourth
                      slot to do it
VISUAL:               no gesture. Everything he left behind goes off at once,
                      in different colours, across the whole room
FLAVOR:               The waiting is the work. The button is not the work and
                      he resents that everyone always asks about the button.

SKILL NAME:           Caltrops
CLASS / TREE / TIER:  assassin / Killbox / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r110, persistent field 6000ms)
RANGE:                melee long (90px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 4 per 500ms tick
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.6 to everything inside
DOT:                  ground tick 4 per 500ms for 6000ms — 48 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (110px) — scattered behind him as
                      the swarm closes
THREAT:               none
--- growth ---
RANK ADDS:            +1 damage per tick; +1s duration every 4th rank; +6px
                      radius every 3rd rank
--- identity ---
ENGINE:               neutral — it is a field, not a device, so it does not
                      occupy an armed slot and does not generate Shadow
COST:                 four damage a tick is the smallest number in the class.
                      It is a slow field and nothing else, and it sits at
                      tier 9 where the player has a right to expect something
                      that kills
VISUAL:               a scatter of small dark shapes that do not look like
                      much until something puts weight on them
FLAVOR:               Two thousand years old and unimproved. There is nothing
                      to improve. Four points, one of them always up, and
                      that is the entire design.

SKILL NAME:           Minefield
CLASS / TREE / TIER:  assassin / Killbox / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (6 devices — centre plus a ring at r112,
                      placed at 200px)
RANGE:                range short (200px)
TARGETS:              per-device burst, uncapped
--- output ---
DAMAGE TIER:          medium (22 per device)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               the six do not count against the armed-device cap
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px, gated on 50 Shadow
THREAT:               none
--- growth ---
RANK ADDS:            +4 damage per device; +1 device every 4th rank; +10px
                      ring radius every 3rd rank
--- identity ---
ENGINE:               consumes 50 Shadow, then feeds +24/sec while all six
                      wait armed — it is both the largest spend and the
                      largest income in the class
COST:                 forty-five seconds and fifty Shadow to place a hundred
                      and thirty-two damage on the floor two hundred pixels
                      away, where it will sit until something walks on it. If
                      the pack routes around it, the entire capstone was a
                      decoration
VISUAL:               six plates dropped in one motion, in a pattern, and
                      then nothing at all for as long as it takes
FLAVOR:               He does not think of it as a trap. A trap is one
                      question. This is a shape, laid out in advance, and
                      whichever way they come through it they will have
                      answered it.

---

## TREE: SHADOW

Role read: **the burst assassin, and the tree the stealth ruling rebuilds.**
Concealment now flickers rather than ending, so the ×1.8 stealthBonus
becomes a rhythm the whole tree plays to. It is the highest single-hit
damage in the class and the only real survivability it has.

---

SKILL NAME:           Silent Blade
CLASS / TREE / TIER:  assassin / Shadow / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (16) — 29 from concealment (×1.8)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               ×1.8 stealthBonus when struck from concealment; the
                      strike drops concealment for 840ms (stealth ruling)
                      — roster ruling 6: 2000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (70px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 target every 5th rank
--- identity ---
ENGINE:               feeds +8 per stealthBonus strike — at 2000ms it is the
                      class's metronome and, under Cloak, its main income
COST:                 sixteen damage without stealth. Every number in this
                      tree assumes concealment, and a visible Assassin
                      running Silent Blade is doing the least damage in the
                      roster
VISUAL:               no wind-up, no follow-through, no sound at all — the
                      animation is shorter than it should be
FLAVOR:               Silence is not the absence of noise. It is the absence
                      of the noises people are listening for, which is a much
                      shorter list and can be worked around.

SKILL NAME:           Cloak of Shadows
CLASS / TREE / TIER:  assassin / Shadow / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
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
RIDERS:               stealth 5600ms, flickering — attacking drops
                      concealment for 2000ms and it re-enters automatically
                      while the buff runs (stealth ruling)
                      — roster ruling 6: 20000ms→5600ms (70% of the 8000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY — its uptime exceeds its cooldown, so it
                      is simply maintained
THREAT:               none — concealment drops all enemy targeting on the
                      Assassin each time it re-enters
--- growth ---
RANK ADDS:            −150ms re-entry delay per rank, floor 800ms (not
                      duration — twenty seconds already exceeds the sixteen-
                      second cooldown, so uptime is already total)
--- identity ---
ENGINE:               consumes 30 Shadow to cast, then feeds +5/sec for every
                      second concealed. Under Cloak the Assassin is roughly
                      concealed 60% of the time, so it pays for itself twice
                      over
COST:                 thirty Shadow at the start of a run, when he has none.
                      The Assassin's opening thirty seconds are the worst in
                      the roster — no engine, no concealment, no armed
                      devices — and Cloak is both the fix and the thing he
                      cannot yet afford
VISUAL:               he does not disappear. The eye keeps sliding to
                      whatever is behind him, and each time he strikes he is
                      briefly, unmistakably there before it slides off again
FLAVOR:               Twenty seconds is a long time. He has been told it is
                      not, by people who have never had to fill one.

> **The stealth ruling in practice:** this skill is the reason it exists.
> As written in ToH, Cloak's twenty seconds end on the first auto-fired
> attack — roughly two hundred milliseconds. Everything about this class
> depends on the flicker.

SKILL NAME:           Ambush
CLASS / TREE / TIER:  assassin / Shadow / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r75)
RANGE:                melee short (75px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          high (48) — 86 from concealment (×1.8)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               ×1.8 stealthBonus from concealment; drops concealment
                      for 2000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (75px), gated to fire ONLY while
                      concealed — it waits for the bonus rather than
                      spending itself at base value
THREAT:               high
--- growth ---
RANK ADDS:            +8 damage (the ×1.8 does not scale, so a rank-10
                      Ambush hits for 230 from concealment)
--- identity ---
ENGINE:               feeds +8 per stealthBonus strike
COST:                 the concealment gate means that without Cloak or
                      Vanish slotted, this skill never fires at all. It is
                      the highest damage in the class and it is entirely
                      dependent on another slot being spent first
VISUAL:               the strike arrives from a direction the target was not
                      considering, and the target's reaction begins after it
                      has finished
FLAVOR:               Not a surprise. A surprise implies they were expecting
                      something else. They were not expecting anything, which
                      took him some effort to arrange and no effort at all to
                      exploit.

SKILL NAME:           Evasive Maneuvers
CLASS / TREE / TIER:  assassin / Shadow / tier_code 3
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
RIDERS:               stat mods: moveSpeedMult +0.08, blockChance +0.12,
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
ENGINE:               neutral
COST:                 eight percent movement is the smallest stat mod in the
                      roster and it is the only one that directly helps at
                      the thing RumbleJam actually tests. It will read as
                      negligible on the tooltip and it is not
VISUAL:               nothing discrete; he stops squaring up to things and
                      starts standing at angles
FLAVOR:               He is not quick. He has simply stopped being anywhere
                      that quickness would have been required.

SKILL NAME:           Shadow Step
CLASS / TREE / TIER:  assassin / Shadow / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at the target point)
RANGE:                range medium (260px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          medium (22) — 40 from concealment
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               the Assassin arrives at the strike point; ×1.8 from
                      concealment; drops concealment for 840ms
                      — roster ruling 6: 2000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 260px — unlike every other
                      movement skill in the roster, this one deliberately
                      goes TOWARD the cluster, because arriving inside a pack
                      concealed is the Assassin's job
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +20px range every 4th rank
--- identity ---
ENGINE:               feeds +8 when it lands from concealment
COST:                 it is the only movement skill in the game that
                      deliberately relocates the player into danger, and the
                      2000ms concealment drop lands the instant he arrives.
                      He is standing in a pack, visible, for two seconds
VISUAL:               he is not there and then he is behind them, with the
                      strike already completed
FLAVOR:               The distance is not crossed. He has been asked whether
                      it is the same trick the Mage does and has said, at
                      some length, that it is not.

SKILL NAME:           Smoke Bomb
CLASS / TREE / TIER:  assassin / Shadow / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range short (200px)
TARGETS:              1
--- output ---
DAMAGE TIER:          none (0) — chip 8 per 700ms during the confusion
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               CONFUSION 85% for 3200ms with chip damage; plus
                      instant self-stealth 1500ms (any attack ends this
                      one immediately — code behavior kept)
DOT:                  8 per 700ms for the confusion's duration
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (120px), preferring the
                      highest-health enemy in range
THREAT:               none — a double threat drop, on the target and on
                      himself
--- growth ---
RANK ADDS:            +2 chip damage per tick; +400ms confusion per rank;
                      +200ms self-stealth every 3rd rank
--- identity ---
ENGINE:               feeds a little — 1500ms of concealment is +7 Shadow,
                      assuming nothing fires during it, which something will
COST:                 the 1500ms self-stealth ends on the next auto-fired
                      attack, which in RumbleJam is immediately. Unlike
                      Cloak, this one does not flicker back — the code makes
                      it a one-shot and I kept it. Its real value is the
                      confusion
VISUAL:               a low grey burst at the target's feet; he is briefly
                      unaccounted for and the target starts swinging at
                      whatever is nearest
FLAVOR:               Smoke does not hide anyone. What it does is make
                      everyone in it start behaving as though they are alone,
                      and that is a much more useful condition to create.

SKILL NAME:           Silent Takedown
CLASS / TREE / TIER:  assassin / Shadow / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r60)
RANGE:                melee short (60px)
TARGETS:              cap 2
--- output ---
DAMAGE TIER:          medium (20) — 36 from concealment
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — executes outright any target below 20% HP,
                      and an execute does NOT drop concealment
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 60px, gated to prefer targets
                      under 20%
THREAT:               none — a takedown that executes leaves him concealed,
                      so it draws nothing
--- growth ---
RANK ADDS:            +4 damage; +2% to the execute threshold every 3rd rank,
                      ceiling 40%
--- identity ---
ENGINE:               feeds +8 per stealthBonus strike, and the no-break
                      execute means a chain of finishes keeps him hidden
                      throughout
COST:                 sixty pixels, the shortest reach in the class, and two
                      targets. Against anything above the threshold it is
                      twenty damage on an eight-second cooldown, which is
                      poor for tier 7
VISUAL:               one motion, from behind, and the target folds rather
                      than falls. There is no sound cue at all
FLAVOR:               Takedown is a word from a manual. What he does has no
                      word in any manual and he has been careful never to
                      supply one.

> **AUTHORED:** ToH's Silent Takedown is a plain 20-damage circle, which
> makes the name meaningless — nothing about it is a takedown or silent. I
> gave it an execute threshold and made the execute preserve concealment,
> which is the mechanic the name and the tree both point at.

SKILL NAME:           Vanish
CLASS / TREE / TIER:  assassin / Shadow / tier_code 7
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
DOMAIN:               mental
--- effects ---
RIDERS:               instant stealth 5000ms plus UNTARGETABLE for 700ms —
                      melee passes through and projectiles miss. Flickers per
                      the stealth ruling
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (35%)
THREAT:               none — the class's hard threat dump
--- growth ---
RANK ADDS:            +100ms untargetable window per rank; +250ms stealth
                      every 3rd rank
--- identity ---
ENGINE:               consumes 25 Shadow, feeds +5/sec while concealed
COST:                 seven hundred milliseconds of genuine invulnerability
                      is the shortest emergency window in the roster, and
                      after it he is merely hidden — which stops the enemies
                      chasing him but does not undo the damage that brought
                      him to 35%. Vanish buys distance and no health
VISUAL:               a hard cut rather than a fade; attacks already in
                      flight pass through the space he was occupying
FLAVOR:               Not an escape. An escape implies a route. This is the
                      considerably simpler business of ceasing to be a
                      subject of the sentence.

SKILL NAME:           Poisoned Edge
CLASS / TREE / TIER:  assassin / Shadow / tier_code 8
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
RIDERS:               scene-keyed [declared, not derived] — "the blades carry
                      venom: every strike leaves a festering wound"
DOT:                  poison applied by every damaging skill — magnitude in
                      MainScene
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2 poison damage per tick per rank; +1s poison
                      duration every 5th rank
--- identity ---
ENGINE:               neutral directly, but poison kills happen after the
                      strike, which means they frequently land while he is
                      concealed again — free damage that costs no
                      concealment
COST:                 it applies to every skill in every tree, which makes it
                      the class's best passive, and it does nothing at all
                      for the Traps tree's devices. A pure trapper takes this
                      and gets a fraction of it
VISUAL:               struck enemies keep a dark spreading mark at the wound
                      and their movement degrades over the following seconds
FLAVOR:               He mixes it himself. Not out of paranoia — out of the
                      more practical concern that a supplier is a person who
                      knows what you buy.

SKILL NAME:           Shadow Dance
CLASS / TREE / TIER:  assassin / Shadow / tier_code 9
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
DOMAIN:               mental
--- effects ---
RIDERS:               for the window, striking does NOT break concealment at
                      all — no flicker, no 2000ms drop — and every strike
                      keeps its full ×1.8 stealthBonus. Enters concealment
                      immediately if not already hidden
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 200px), gated on 60 Shadow
THREAT:               none — he is unfindable for the entire duration
--- growth ---
RANK ADDS:            +500ms duration per rank; +0.1× to the stealthBonus
                      every 5th rank
--- identity ---
ENGINE:               consumes 60 Shadow and then refunds enormously — +5/sec
                      concealed *plus* +8 per stealthBonus strike, with every
                      strike qualifying. It is the only skill in the class
                      that can refill the bar outright
COST:                 fifty seconds and sixty Shadow. It is the capstone the
                      whole tree was built for and it requires the Assassin
                      to have already been playing well — concealed,
                      trapped up, banking — for most of a minute to afford
                      it. A bad opening pushes it out of reach for the whole
                      run
VISUAL:               he stops flickering. Everything lands and nothing
                      reveals him, and the enemies keep turning toward where
                      the last one died
FLAVOR:               There is a state where the hiding and the working stop
                      being separate activities that interrupt each other.
                      He has reached it perhaps a dozen times in his life and
                      has never been able to make it last.

---

## TREE: RANGE  (was Marksman in the source conversion)

Role read: **the safe tree, and the one that needed the most repair.** Ten
thrown-weapon skills, six of them single-target with no rider as shipped.
It is the only way an Assassin fights at range and, before the four
authored riders below, it was six interchangeable stars.

---

SKILL NAME:           Throwing Star
CLASS / TREE / TIER:  assassin / Range / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (15) — 27 from concealment
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               ×1.8 from concealment; drops concealment for 840ms
                      — roster ruling 6: 2000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (340px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; at rank 6 it pierces 1 additional enemy,
                      +1 every 6 ranks
--- identity ---
ENGINE:               feeds +8 per stealthBonus strike
COST:                 fifteen damage. It is the tree's metronome and it is
                      also the reason a ranged Assassin's concealment is
                      constantly breaking — every two seconds, at a distance,
                      for very little
VISUAL:               a flat spinning throw with no arc, and the second one
                      is already in his hand before the first lands
FLAVOR:               Not accurate. Accurate is for one. He throws in the
                      direction of a problem and adjusts based on what
                      screams.

SKILL NAME:           Throwing Mastery
CLASS / TREE / TIER:  assassin / Range / tier_code 1
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
RIDERS:               stat mods: damageMult +0.12
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage multiplier per rank — global, applies to
                      every tree
--- identity ---
ENGINE:               neutral
COST:                 the fourth uncapped global damage multiplier in the
                      roster, after Berserker's Edge, Encapsulation and
                      Perfect Pitch. It is the smallest of the four and it
                      has the same unbounded shape
VISUAL:               nothing visible
FLAVOR:               Mastery is a strong word for having done something an
                      enormous number of times. He has never claimed the
                      strong word and other people keep applying it.

SKILL NAME:           Rapid Shot
CLASS / TREE / TIER:  assassin / Range / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                multi-target (rapid volley)
RANGE:                range medium (320px)
TARGETS:              4 stars in sequence, 120ms apart, each seeking the
                      nearest available target (port change — see COST)
--- output ---
DAMAGE TIER:          low (7 per star)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               only the FIRST star of the volley receives the
                      concealment bonus; the volley drops concealment on that
                      first hit
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 320px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per star; +1 star every 4th rank
--- identity ---
ENGINE:               feeds +8 once per volley, not per star
COST:                 twenty-eight damage split four ways, and it burns the
                      concealment bonus on a seven-damage hit. In a
                      stealth build it is actively counterproductive — it
                      spends the ×1.8 on the smallest number in the class
VISUAL:               four throws in half a second from a stationary stance,
                      each from a slightly different angle
FLAVOR:               Rapid is not the same as hurried and he would like the
                      distinction respected.

> **Port change flagged:** ToH's Rapid Shot is a single 7-damage projectile
> — the second-lowest number in the roster, and the name says rapid. Made it
> a four-star volley. Flagged.

SKILL NAME:           Ensnaring Shot
CLASS / TREE / TIER:  assassin / Range / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (11)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — root 2500ms, and the rooted enemy also
                      roots the first other enemy that touches it during the
                      window
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (150px) — pins whatever is closing
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +300ms root every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 eleven damage. The chained root is what saves it from
                      being Snare Trap at range, and it needs the pack tight
                      enough for one enemy to bump another
VISUAL:               a weighted line that wraps and locks; whatever walks
                      into the rooted enemy gets caught in the same tangle
FLAVOR:               One is a delay. Two is a bottleneck. Three would be
                      greedy and he has never managed it on purpose.

> **AUTHORED:** no rider in ToH — 11 damage, single target, 8s cooldown.
> Name promises a snare; I added the root and the chain.

SKILL NAME:           Piercing Strikes
CLASS / TREE / TIER:  assassin / Range / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                line
RANGE:                range medium (380px)
TARGETS:              AUTHORED — pierces every enemy along the line
--- output ---
DAMAGE TIER:          low (13)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               each successive enemy pierced takes 10% more than the
                      last, so the far end of a line takes the most
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 380px — aims along the axis
                      lining up the most bodies
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +2% to the escalation per pierce every 3rd
                      rank
--- identity ---
ENGINE:               neutral
COST:                 it needs enemies in a row and the Assassin has one
                      skill that arranges them — Ensnaring Shot, one tier
                      below, on a different cooldown. Against a scattered
                      swarm it is Throwing Star for less
VISUAL:               a single heavy blade that does not slow, and the sound
                      of each pass is a little louder than the last
FLAVOR:               It does not lose energy going through. He has checked,
                      repeatedly, and has stopped mentioning it because of
                      the look people give him.

> **AUTHORED:** no pierce in ToH — single target, 13 damage, and the name is
> plural and says piercing. Added the pierce and the escalation.

SKILL NAME:           Poisoned Stars
CLASS / TREE / TIER:  assassin / Range / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — heavy poison, 7 per 1000ms for 6000ms,
                      which stacks with Poisoned Edge rather than replacing
                      it
DOT:                  7 per 1000ms for 6000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy not already carrying
                      this poison
THREAT:               none
--- growth ---
RANK ADDS:            +2 impact damage; +2 poison per tick every 2nd rank;
                      +1s duration every 5th rank
--- identity ---
ENGINE:               neutral
COST:                 fifty-four damage over six seconds into one enemy. In a
                      build already running Poisoned Edge the two poisons
                      overlap conceptually and the player has no way to tell
                      which number on screen belongs to which
VISUAL:               the stars are darkened at the edge and the wounds they
                      leave do not close
FLAVOR:               Same mixture as the blades. He sees no reason to
                      maintain two recipes and considerable reason not to.

> **AUTHORED:** no rider in ToH. A star called Poisoned with no poison.

SKILL NAME:           Trick Shot
CLASS / TREE / TIER:  assassin / Range / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain
RANGE:                range medium (300px)
TARGETS:              chain, 3 jumps
--- output ---
DAMAGE TIER:          low (18)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 chain jump every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 seventy-two damage across four enemies is respectable
                      and the chain needs them within jump distance of each
                      other, which the Marksman tree does nothing to arrange
                      and the Traps tree actively does
VISUAL:               one throw, several impacts, and the geometry connecting
                      them is not obviously possible
FLAVOR:               He worked this out on a wall in a warehouse over
                      several months and has never once explained the angles
                      to anybody who asked.

SKILL NAME:           Fan of Blades
CLASS / TREE / TIER:  assassin / Range / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (90° total)
RANGE:                range short (170px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 170px — the fan orients to the
                      cluster centroid
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +6° cone width every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 it is the only genuine area attack in the Marksman
                      tree and it sits at tier 8, which means a ranged
                      Assassin spends seven tiers with no answer to a crowd
                      except the trap tree he did not take
VISUAL:               a spread of five or six thrown at once in a single
                      sweep of the arm
FLAVOR:               Wasteful. He knows. There is a version of him that
                      would collect them afterward and that version has never
                      survived a room this crowded.

SKILL NAME:           Crippling Shot
CLASS / TREE / TIER:  assassin / Range / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — slow ×0.4 for 2800ms and vulnerability: the
                      target takes +25% damage from all sources for the
                      duration
                      — roster ruling 6: 5000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED, preferring the highest-health enemy
                      in range — the vulnerability is worth most on whatever
                      takes longest to kill
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +3% vulnerability every 2nd rank; +400ms
                      duration every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 twelve damage at tier 9. It is a pure setup skill and
                      it amplifies whatever the Assassin does next — which,
                      in an auto-fire game, he does not choose
VISUAL:               a low shot that takes the leg out from under the
                      target's rhythm; it keeps moving and stops being able
                      to commit to anything
FLAVOR:               Crippling is not about the leg. He has explained this
                      exactly once, to somebody who did not need to know, and
                      has regretted it since.

> **AUTHORED:** no rider in ToH — 12 damage, single target, 9s cooldown, at
> tier 9. Name promises a cripple; added slow plus vulnerability so the tree
> has one setup node.

SKILL NAME:           Rain of Steel
CLASS / TREE / TIER:  assassin / Range / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r140, persistent hazard 3500ms)
RANGE:                range short (240px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 11 per 300ms tick
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  ground tick 11 per 300ms for 3500ms — roughly 128 to
                      anything that stays the full duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 240px, gated on 40 Shadow
THREAT:               none
--- growth ---
RANK ADDS:            +3 damage per tick; +1s duration every 4th rank; +10px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 40 Shadow
COST:                 three and a half seconds is a short window for a
                      forty-five-second cooldown, and nothing in the Marksman
                      tree holds enemies in place — the traps that would do
                      that are in a tree this build did not take. Placed on a
                      moving swarm it collects perhaps a third of its stated
                      damage
VISUAL:               a dense vertical fall inside a hard circle, the ground
                      bristling afterward, everything inside it flinching
                      continuously
FLAVOR:               He does not know how many. He stopped counting them out
                      years ago and started weighing the bag instead, which
                      tells you most of what there is to know about how this
                      profession goes.
