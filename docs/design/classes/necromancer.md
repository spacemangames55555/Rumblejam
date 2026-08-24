# NECROMANCER — RUMBLEJAM CONVERSION (31 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.

---

## TREE RULING (settled)

The three tree NAMES match the built trees exactly — Marrow, Summons, Dark
Matter. The contents do not, and that is the part that needed a decision.

| tree | shared with built | ruling |
|---|---|---|
| Dark Matter | 9 of 10 | **revise in place** — the built tree is the same tree; this document's Singularity replaces Dark Energy Burr |
| Marrow | 8 of 10 | **revise in place** — Osteo Aura and Grasp of Death replace Quill and Banshee's Wail |
| Summons | **1 of 10** | **this document supersedes the built tree.** Implementing it is `js/` work for a later patch |

The built Summons tree shares only Army of the Dead. It has summons in it but
no commander mechanics under any name — no aggro ladder, no summon-only
multipliers — so this is not a renaming, it is a mechanism the code does not
have. The Essence engine depends on it: the +8-per-summon-kill tier and the
+10-when-a-summon-dies refund are written against a tree that must exist.

Two shared names are different skills and must not be transcribed across:
**Blight** is a passive aura here and an active 4.2s hazard in code; **Bone
Spur** is a 40% passive reflect here and an active `ward` in code.

### OPEN, ROSTER-WIDE: tree shape

The built Marrow and Summons are **branching** — six tiers, four exclusive
pairs each, sixteen branch nodes across the two. This document is linear with
exactly **one** branch pair in the whole class (`necro_skeleton_branch`, Blood
against Marrow Skeleton), which is why it carries 31 blocks rather than 30.

Linear-with-one-branch and four-pairs-per-tree are incompatible shapes and
picking one renumbers every tier in the file. **Not resolved here** — it is a
roster-wide decision, it affects all fourteen documents, and it cannot be
settled in a documents-only pass because the built shape lives in `js/`.

---

## ROSTER RULING APPLIED

Against `roster-ruling-pace-damage-engines.md`. What moved, what held.

**Pace (ruling 1).** 21 of 22 timed actives rebucketed to the fixed values.
Grasp of Death is held — see the conflicts below. Distribution: Dark Matter
passes on its own (7 medium-or-faster, 0 very slow), Marrow passes **only if
Stake's root is shortened**, Summons **cannot pass** — see below.

**Damage share (ruling 2).** Marrow 6 damage nodes, 1 high. Dark Matter 10
damage nodes, and its high-tier node comes from relabelling Singularity off
its 8-pulse total rather than its per-pulse figure — no number changed, and
ruling 2 could not otherwise be met without retuning, which the ruling's own
"out of scope" clause forbids. Summons has 2 and fails — see below.

**Passive budget (ruling 4).** Nine passives across the class against a
four-slot budget: Marrow 3, Summons 5, Dark Matter 1. Binding, and worth
stating plainly — **a pure Summons build cannot slot its own passive set**,
so Unyielding Beast, Necrotic Presence, Tentacles and the skeleton branch
compete against each other for four of the class's slots.

**Channels (ruling 5).** Already compliant — port ruling 4 wrote the 60%
moving tick before the roster ruling existed. One clarification added: for
Death Channel and Dark Energy Beam the cooldown now runs from the channel's
END, since the slow bucket's 3s otherwise sits under a 10s channel.

**Engine cost (ruling 3).** Not applicable. Essence is a bank that builds, not
one of the two depleting engines.

### THE RULING AGAINST THE CLASS — four held, not resolved

**1. Shortened cooldowns turn timed riders permanent.** The ruling sets
cooldowns and says nothing about rider durations, so every rider whose
duration now exceeds its cooldown becomes an always-on effect. Three here:

| skill | rider | new cooldown | result |
|---|---|---|---|
| Stake | root 2500ms | 1500ms | permanent single-target root |
| Hex of Entropy | slow ×0.5 + weaken 40%, 2000ms | 1500ms | permanent area control |
| Marrownaut | form 30000ms | 6000ms | permanent +50% HP / +45% mitigation |

This is not a Necromancer problem. It will hit every class with a timed rider,
and it wants one roster-wide companion rule rather than fourteen local fixes.

**2. Summons cannot satisfy the distribution rule and stay a summoner tree.**
Five passives plus a capstone leave five timed actives, of which four must be
medium-or-faster. Two already are. The other three are Unleash the Monster,
Dark Matter and Death Channel — a single pet, a capped second summon, and a
ten-second channel. A skeleton every 0.4s is not a commander, and a channel on
a cooldown shorter than itself is not a channel.

**3. Summons cannot satisfy the damage-share floor either, for the same
reason.** Six of its nodes read `DAMAGE TIER: none (0) — the skeleton deals
the damage, not the cast`. The tree has output; it is delivered by bodies. The
rule as written counts the cast. It needs to count a summon's damage as the
node's damage, or summoner trees fail it by construction.

**4. Grasp of Death is a capstone the capstone bucket destroys.** It is
Marrow's tier-10 and the class's only self-heal — 40 damage on a 60% drain,
currently 9s. The capstone bucket says 20–30s, which removes the Necromancer's
sustain; the slow bucket says 3s, which makes a 24-point heal available twenty
times a minute. Held at 9s, in no bucket, deliberately.

---

## CLASS ENGINE — ESSENCE

The Necromancer is an economy class. He does not fight the swarm; he
converts it. **ESSENCE, 0–100**, starts each run at 20.

Feeds:
- Any enemy dying within 400px: **+5**
- An enemy killed by one of his summons: **+8** (summons feed the engine
  better than he does — this is the whole class)
- Death Channel / Dark Energy Beam ticks: **+1 per tick**
- A summon of his dying: **+10** (he gets the material back)

Consumes:
- Summon Skeleton: **10** · Unleash the Monster: **30** · Dark Matter: **25**
- Army of the Dead: **60** · Singularity: **40**
- A summon skill will not fire below its cost.

Decays **1/sec** — slower than Forge Heat, because Essence is a bank, not a
temperature. Where the Blacksmith spikes when he's losing, the Necromancer
compounds when he's winning, and a bad opening leaves him with nothing to
raise. That asymmetry is the two classes' whole relationship.

---

## PORT RULINGS

**1. Summons are the answer to solo tanking.** The code already contains an
aggro hierarchy — Marrow Skeleton's declared text states skeleton aggro sits
*below the Monster's and above yours*. That is a three-tier threat ladder
shipped in ToH, and it is exactly what makes THREAT and `THREAT_ON_ALLY`
meaningful in solo RumbleJam. Ruling: **summons are targetable, take aggro,
and die.** The Necromancer's survival is a body-count problem, not a
mitigation problem. Threat priority: Monster > Skeletons > Necromancer.

**2. Summon persistence.** Summons persist until killed, no timer. Each
summon skill has a standing cap (below) and re-fires automatically when
under cap and Essence allows. This makes `COOLDOWN_READY` the correct
trigger for nearly the whole Summons tree, and it means the tree plays
itself — correctly, because the fantasy is a commander, not a caster.

**3. Summon caps and rank.** Skeletons cap 3 (+1 per 4 ranks). Monster caps
1 (never more — it is a pet, not a swarm). Dark Matter caps 2 (+1 per 6
ranks). Army of the Dead spawns 6 at once on a 60s cooldown, ignoring caps,
and those expire after 20s. Ranks on summon skills buy **summon stats**, not
caster damage — stated per skill.

**4. Channels are a problem and I did not fully solve it.** Death Channel
and Dark Energy Beam cancel on movement. Movement is the player's only input
in RumbleJam. A channel that breaks when you move is a skill that never
completes. Ruling: **channels do not break on movement in RumbleJam** — they
break on the target dying or leaving range, and they tick at reduced rate
(60%) while the caster is moving. Flagged as the largest single behavioral
change in this class; overrule if you'd rather channels stay unusable-by-
design or be cut entirely.

**5. Stacking DoTs get `TARGET_UNAFFECTED` with a stack ceiling.** Entropy
Cascade and Internal Collapse re-cast to stack. Left on `NEAREST_IN_RANGE`
they would dump all stacks into one enemy and idle. Ruling: they fire at the
nearest enemy **below max stacks**, spreading naturally across the swarm and
topping up as stacks expire.

**6. The branch pair is the class's role fork.** Blood Skeleton (DPS) vs
Marrow Skeleton (tank/support) is a WoW spec choice living inside one tree.
I authored both as genuinely different builds rather than a damage number
and a slightly smaller damage number.

**7. Auras rank into radius** (carried from Blacksmith ruling 2). Osteo Aura
and Blight both occupy a slot and are always-on.

---

## TREE: MARROW

Role read: **the off-tank.** The tree that lets a summoner survive the
moment his summons are dead. Bone Spur reflects, Calcify and Marrownaut
absorb, Grasp of Death is the only self-heal in the class. Solo this tree is
mandatory; in co-op it is what a Necromancer takes when nobody else will
hold the line.

---

SKILL NAME:           Bone Dart
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (460px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 very fast (400ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (460px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; pierces 1 additional enemy at rank 6, +1
                      per 6 ranks thereafter
--- identity ---
ENGINE:               neutral — but at 400ms it produces kills, and kills
                      are Essence
COST:                 single target on a 400ms cycle is a rifle in a game
                      about crowds. It will out-damage everything early and
                      fall behind hard by the time enemies arrive twelve at
                      a time
VISUAL:               a splinter of bone leaves his hand flat and fast, no
                      arc, a dry crack on impact
FLAVOR:               He does not carry ammunition. He is, at all times,
                      carrying two hundred and six pieces of it, and has
                      long since stopped thinking of them as his.

SKILL NAME:           Spiked Punch
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r72)
RANGE:                melee short (72px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 fast (800ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (72px)
THREAT:               some
--- growth ---
RANK ADDS:            +5 damage
--- identity ---
ENGINE:               neutral
COST:                 a melee skill on a class whose entire survival plan is
                      being somewhere else. Every time this fires, the
                      Necromancer has already made a positioning mistake
VISUAL:               a jab that lands with an audible splintering; bone
                      spurs push out through the knuckles on contact and
                      retract
FLAVOR:               Murmansk taught him that the body is a toolkit you are
                      standing inside. Most people find that thought
                      unpleasant. He finds it convenient.

SKILL NAME:           Bone Nova
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r165 on caster)
RANGE:                range short (165px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 medium (1500ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 90px; knockback-stun 160ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 165px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +15px knockback every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 the knockback scatters the pack, which is good for
                      survival and actively bad for the Singularity build
                      that wants everything in one place. The Dark Matter
                      tree and this skill are quietly at war
VISUAL:               a ring of bone shards erupting from the floor at the
                      radius edge and collapsing inward
FLAVOR:               There is more bone under any ground than people care
                      to know. He simply asks it to stand up for a moment.

SKILL NAME:           Calcify
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 3
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
RIDERS:               stat mods: damageReduction +0.12, maxHPMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2.5% damage reduction and +5% max HP per rank (not
                      damage)
--- identity ---
ENGINE:               neutral
COST:                 a slot that produces no corpses, and corpses are this
                      class's currency. Defensive slots on a Necromancer cost
                      more than they do on anyone else
VISUAL:               skin over the sternum and forearms takes on a chalky,
                      slightly translucent hardness
FLAVOR:               Bone is the only part of a person that was never
                      really alive. He has been quietly increasing his
                      proportion of it for some years.

SKILL NAME:           Marrownaut
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 4
TYPE:                 transformation
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (6000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               form 30000ms — maxHPMult +0.50, damageReduction +0.45;
                      caster size increases (the game's only size-change)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (45%)
THREAT:               high
--- growth ---
RANK ADDS:            +4% damage reduction and +6% max HP per rank; +2s
                      duration every 4th rank
--- identity ---
ENGINE:               neutral — no Essence cost. This is the one big
                      cooldown the class can always afford, which is the
                      point
COST:                 the size increase is not cosmetic. A larger hitbox in
                      a bullet-hell room means more contacts, and this skill
                      makes the player physically harder to keep safe for
                      thirty seconds. It gives you durability and takes away
                      evasion. RULING CONFLICT — HELD: the very-slow bucket
                      puts the cooldown at 6s under a 30000ms form, so the
                      transformation never lapses and +50% HP / +45% damage
                      reduction become permanent stats. Either the form comes
                      down to a few seconds or this node needs a cooldown the
                      bucket table does not have
VISUAL:               he swells — the skeleton visibly thickening beneath,
                      plates of bone shouldering up through the coat, half a
                      head taller and much wider
FLAVOR:               The armour was always in there. Getting into it is
                      simply a matter of persuading the body that its own
                      frame belongs on the outside.

> **Size-change flagged:** this is the only skill in ToH that changes the
> player's dimensions, and RumbleJam's entire difficulty is hitbox
> avoidance. I've written the drawback in deliberately rather than hiding
> it, but if RumbleJam's collision can't handle a variable player hitbox,
> this becomes a plain defensive buff and loses its best idea.

SKILL NAME:           Stake
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r84)
RANGE:                melee long (84px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (14)
PACE:                 medium (1500ms)
DOMAIN:               physical
--- effects ---
RIDERS:               root 2500ms — port addition, see COST
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (84px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +300ms root every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 RULING CONFLICT — HELD. The pace pass promoted this
                      from slow to medium (10s to 1.5s) because Marrow needs
                      a fourth medium-or-faster node and this was the tree's
                      weakest, by its own former COST line. But the root is
                      2500ms and the cooldown is now 1500ms, so as written it
                      is a PERMANENT single-target root. The root needs to
                      come down to roughly 900ms, or this stays slow and
                      Marrow fails the distribution rule. Not resolved here
VISUAL:               a spike of yellowed bone driven down through the foot,
                      pinning the enemy in place; it snaps when they tear free
FLAVOR:               A stake is not a weapon. It is a statement about where
                      something is going to remain.

> **Port addition flagged:** ToH's Stake has no rider — 14 damage on a 10s
> cooldown and nothing else, which is a dead node in a game where slots are
> scarce. I added a 2.5s root rather than inflating the damage, because
> "pin something in place" is what the name and animation already promise.
> This is invention, not derivation. Cut it and the skill should probably
> be cut too.

SKILL NAME:           Osteo Aura
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 6
TYPE:                 passive (aura)
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                ground area (circle on caster, always active)
RANGE:                range short (180px — verify against MainScene)
TARGETS:              uncapped in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 n/a (continuous)
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "enemies near you
                      have lowered defense: they take +25% damage from you"
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +12px radius per rank (not damage, not magnitude)
--- identity ---
ENGINE:               feeds indirectly — a +25% damage field produces more
                      kills, and kills are Essence
COST:                 it amplifies *your* damage, not your summons'. A pure
                      summoner build gets nothing from it, so the tier-7 node
                      of the survival tree quietly demands you also be
                      casting things
VISUAL:               a dim bone-white circle on the floor; enemies inside it
                      look thinner, their outlines showing structure
FLAVOR:               Everything alive is a wall built around a frame. He
                      finds it very hard to stop noticing where the frame is.

> **Scope flagged:** the declared text says "+25% damage from you." Whether
> summons count as "you" is the single most consequential ambiguity in this
> class. I've read it narrowly (caster only) because that's what the text
> says. If MainScene includes summon damage, Osteo becomes the summoner
> keystone and my COST line above is wrong.

SKILL NAME:           Bone Spur
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 7
TYPE:                 passive
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              1 (the attacker)
--- output ---
DAMAGE TIER:          n/a (reflects 40% of damage taken)
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: reflectPct 0.40
DOT:                  none
AFFECTS:              enemies, self
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN
THREAT:               none
--- growth ---
RANK ADDS:            +5% reflect per rank
--- identity ---
ENGINE:               feeds — reflect kills count as caster kills, +5 Essence
COST:                 it scales off incoming damage, so it is strongest
                      exactly when the run is going worst, and it does
                      nothing at all for a player who is not being hit. On a
                      class that wants its skeletons taking the hits instead,
                      it is in direct conflict with the Summons tree
VISUAL:               spurs of bone snap outward from wherever he was struck,
                      then withdraw
FLAVOR:               Touching him has consequences. He has never once
                      warned anyone about this and does not consider that
                      dishonest.

SKILL NAME:           Wrecking Ball
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (320px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (28)
PACE:                 slow (3000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockdown — stun 1500ms per enemy hit; caster displaced
                      320px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (100px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               high
--- growth ---
RANK ADDS:            +4 damage; +150ms knockdown every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 320px of forced displacement on a class that has spent
                      the whole run carefully placing summons between itself
                      and the swarm. It will regularly throw the Necromancer
                      out from behind his own wall
VISUAL:               he tucks into a hunched roll and the bone plating
                      closes over him; enemies go down like skittles
FLAVOR:               Undignified. Effective. He has made his peace with the
                      trade, and the skeletons do not comment.

SKILL NAME:           Grasp of Death
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target (nearest)
RANGE:                melee long (120px)
TARGETS:              1
--- output ---
DAMAGE TIER:          high (40)
PACE:                 slow (9000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               drain — heals caster for 60% of damage dealt
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (65%), falling back to
                      LOWEST_HP_ENEMY within 120px when at full health
THREAT:               some
--- growth ---
RANK ADDS:            +6 damage (the 60% drain ratio does not scale, so heal
                      grows with damage automatically)
--- identity ---
ENGINE:               feeds — the highest single-hit damage in the class
                      finishes things, and finishing things is +5 Essence
COST:                 120px. The only reliable heal in the Necromancer's
                      kit requires him to be within arm's reach of something
                      hostile, which is where he is least able to survive
                      being wrong
VISUAL:               a skeletal hand of black vapour closes around the
                      target's chest; a thread of dull red runs back along
                      his arm
FLAVOR:               He is not taking their life. Life does not transfer
                      like that. He is taking the arrangement — the pattern
                      that was holding them together — and wearing it for a
                      while.

---

## TREE: SUMMONS

Role read: **the commander, and the class's answer to every role at once.**
Skeletons are the tank. The Monster is the DPS. The Necromancer behind them
is the healer, in the only sense RumbleJam allows: he replaces bodies faster
than they break. Threat ladder: Monster > Skeletons > you. This is the tree
that makes a solo Necromancer feel like a five-man group.

---

SKILL NAME:           Summon Skeleton
CLASS / TREE / TIER:  necromancer / Summons / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 3 standing, +1 per 4 ranks
--- output ---
DAMAGE TIER:          none (0) — the skeleton deals the damage, not the cast
PACE:                 medium (1500ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               summon persists until killed; takes aggro above the
                      caster, below the Monster
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being under cap
THREAT:               none (the skeleton carries the threat, not the cast)
--- growth ---
RANK ADDS:            +10% skeleton damage and +10% skeleton HP per rank;
                      +1 to the standing cap every 4th rank (ranks buy
                      summon stats, not caster damage)
--- identity ---
ENGINE:               consumes 10 Essence per skeleton; feeds +8 whenever a
                      skeleton lands a killing blow, so a working skeleton
                      pays for itself in two kills
COST:                 a second and a half to replace one body. When a wave
                      breaks through and takes all three at once, the tree's
                      entire value takes four and a half seconds to come
                      back — the pace pass turned the class's worst moment
                      from a twelve-second hole into a survivable one, and
                      Essence at 10 a skeleton is now the real limit rather
                      than the cooldown
VISUAL:               the floor cracks and a hand comes up first; the rest
                      assembles in under a second, badly, and it works anyway
FLAVOR:               The first one took him a year and left him weeping.
                      This one took a second and a half. He is not sure
                      which of those facts he should be more troubled by.

SKILL NAME:           Unleash the Monster
CLASS / TREE / TIER:  necromancer / Summons / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 1, always
--- output ---
DAMAGE TIER:          none (0) — the Monster deals 26 per swing / 1100ms
PACE:                 very slow (6000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               MAGNET aggro r300 — actively pulls enemy attention off
                      the caster within that radius; top of the threat ladder
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the Monster being dead or
                      unspawned
THREAT:               high (via the summon — this is the class's taunt)
--- growth ---
RANK ADDS:            +12% Monster damage and +12% Monster HP per rank;
                      +20px aggro magnet radius every 3rd rank
--- identity ---
ENGINE:               consumes 30 Essence
COST:                 six seconds. RULING CONFLICT — REPORTED: at twenty-two
                      the Monster's death was a genuine crisis and the doc
                      called that the correct emotional weight for a
                      single-target pet. At six it is an inconvenience. The
                      bucket is applied because the ruling asks for it, but
                      the 30 Essence is now the only thing making the Monster
                      feel scarce, and Essence caps at 100
VISUAL:               a seam opens in the air at waist height and something
                      much larger than the seam comes through sideways
FLAVOR:               He does not name it. Naming a thing implies you expect
                      to be introducing it to someone.

SKILL NAME:           Unyielding Beast
CLASS / TREE / TIER:  necromancer / Summons / tier_code 2
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "your Monster is
                      far hardier: +50% life and −30% damage taken"
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +8% Monster life per rank; +2% Monster damage
                      reduction per rank, floor at 60% total (not damage)
--- identity ---
ENGINE:               feeds indirectly — a Monster that survives keeps
                      killing, and its kills are the +8 Essence tier
COST:                 completely worthless without Unleash the Monster
                      slotted, and it does nothing for skeletons. It is the
                      most build-locked node in the class: two slots spent
                      before it produces a single point of value
VISUAL:               the Monster's hide takes a wet obsidian sheen; hits
                      that should stagger it visibly don't
FLAVOR:               He rebuilt it. Again. There is more of the repair in
                      it now than there ever was of the original, and it has
                      never once objected.

SKILL NAME:           Necrotic Presence
CLASS / TREE / TIER:  necromancer / Summons / tier_code 3
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
RIDERS:               scene-keyed [declared, not derived] — "all your summons
                      gain +20% damage and +20% health while unlocked"
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +6% summon damage and +6% summon health per rank
                      (applies to every summon the class owns)
--- identity ---
ENGINE:               feeds — the single best Essence multiplier in the
                      class, because it improves every source of the +8 tier
                      at once
COST:                 it produces nothing on its own. Slotted into a build
                      with no summons out — because they all just died — it
                      is eight seconds of nothing while you re-raise
VISUAL:               a faint grey-green cast to every summon he owns, like
                      they are all lit by the same absent light
FLAVOR:               They are not separate things that he happens to own.
                      They are the far ends of a single intention, and the
                      intention has been getting stronger.

SKILL NAME:           Dark Matter
CLASS / TREE / TIER:  necromancer / Summons / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 2, +1 per 6 ranks
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (3000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               summon persists until killed
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being under cap
THREAT:               none
--- growth ---
RANK ADDS:            +10% summon damage and HP per rank; +1 cap every 6th
                      rank
--- identity ---
ENGINE:               consumes 25 Essence
COST:                 it sits between Skeleton and Monster and is clearly
                      better than neither. At three seconds it has stopped
                      being too slow to be a replaceable body, which resolves
                      half its old problem and sharpens the other half: it is
                      now a Skeleton that costs 25 Essence instead of 10. Its
                      argument is that it is the only summon that scales into
                      the Dark Matter tree's fantasy
VISUAL:               a fold of not-quite-space that moves like something
                      swimming, edges refusing to resolve
FLAVOR:               It came out of the same door as the Monster and he
                      does not believe it is the same kind of thing. He has
                      stopped asking.

SKILL NAME:           Blood Skeleton
CLASS / TREE / TIER:  necromancer / Summons / tier_code 5
TYPE:                 passive
AXIS POSITION:        6 (of 10) — BRANCH PAIR 'necro_skeleton_branch'
                      (exclusive with Marrow Skeleton)
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
RIDERS:               scene-keyed [declared, not derived] — "your skeletons
                      deal +50% damage — the DPS path (you tank in
                      Marrownaut)"
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +12% skeleton damage per rank
--- identity ---
ENGINE:               feeds heavily — skeleton kills are the +8 Essence
                      tier, and this path produces the most of them
COST:                 the code's own description names the cost exactly: you
                      tank in Marrownaut. Choosing this means your skeletons
                      will not hold the line, so the Marrow tree stops being
                      optional and two of your eight slots are spoken for
                      before you have picked an attack
VISUAL:               the bone runs dark and wet at the joints; they move
                      faster and hit like they mean it
FLAVOR:               He sharpened them. That is the entire explanation and
                      it is more disquieting than a longer one would be.

SKILL NAME:           Marrow Skeleton
CLASS / TREE / TIER:  necromancer / Summons / tier_code 5
TYPE:                 passive
AXIS POSITION:        6 (of 10) — BRANCH PAIR 'necro_skeleton_branch'
                      (exclusive with Blood Skeleton)
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
RIDERS:               scene-keyed [declared, not derived] — "your skeletons
                      pull aggro from wider and grow tankier (+defense/HP);
                      their aggro stays below the Monster's, above yours"
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               high (delegated — the skeletons carry it)
--- growth ---
RANK ADDS:            +10% skeleton HP and +25px aggro pull radius per rank;
                      +2% skeleton damage reduction per rank (not damage)
--- identity ---
ENGINE:               feeds slowly but reliably — fewer kills per skeleton,
                      far more skeleton-seconds on the field
COST:                 your skeletons stop killing things. Damage output drops
                      hard, and the class's clear-speed problem — it is
                      already the slowest killer in the roster — gets worse.
                      What you buy is that you almost never get touched
VISUAL:               thicker, slower, heavier in the shoulder; they plant
                      themselves rather than chase
FLAVOR:               He asked them to stand between. That is all. They have
                      never needed to be asked twice, and he has never
                      worked out whether that is loyalty or just the shape
                      he built them in.

> **Role fork note:** this is the clearest tank-versus-DPS choice in the
> game and it is already in your code. In co-op, Marrow Skeleton is a real
> tank spec — the Necromancer's skeletons peel for the whole party. Solo,
> Blood Skeleton is usually correct. I'd protect this pair carefully; it's
> a model for how the other thirteen classes could express role choice
> without adding systems.

SKILL NAME:           Tentacles of Dark Matter
CLASS / TREE / TIER:  necromancer / Summons / tier_code 6
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
RIDERS:               scene-keyed [declared, not derived] — "the Monster
                      lashes out with dark tendrils: its swing reaches
                      farther, striking more enemies at once (cleave)"
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +1 cleave target every 2nd rank; +8px Monster reach
                      per rank (not damage)
--- identity ---
ENGINE:               feeds — turns the Monster from a single-target pet
                      into a crowd-killer, which multiplies the +8 tier
COST:                 a third slot spent on the Monster before the Monster
                      has become the best thing in your build. Unleash,
                      Unyielding, and this is three of eight, and if the
                      Monster dies you are running a five-slot character
VISUAL:               the swing arc trails black filaments that keep moving
                      after the arm has stopped
FLAVOR:               It has been reaching for things slightly beyond where
                      its arms end for some time now. He noticed. He decided
                      to encourage it.

SKILL NAME:           Death Channel
CLASS / TREE / TIER:  necromancer / Summons / tier_code 7
TYPE:                 channel
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                beam
RANGE:                range medium (360px)
TARGETS:              1 (locks nearest)
--- output ---
DAMAGE TIER:          low (14 per tick)
PACE:                 slow (3000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               does NOT break on movement (port ruling 4, and roster
                      ruling 5); ticks at 60% rate while the caster is moving;
                      breaks on target death or leaving 360px. The cooldown
                      runs from the moment the channel ENDS, not from the cast
                      — the slow bucket's 3s sits under a 10s channel, and any
                      other reading makes the cooldown meaningless
DOT:                  14 per 500ms for up to 10000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 360px
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per tick; +1s maximum channel duration every
                      4th rank
--- identity ---
ENGINE:               feeds — +1 Essence per tick, making this the class's
                      steadiest income and the reason a summoner can afford
                      to keep raising
COST:                 it locks one target for up to ten seconds while the
                      swarm is a swarm. Enormous single-target throughput,
                      zero answer to being surrounded, and the 60% moving
                      penalty means it is worst exactly when the player is
                      doing their job. At a 3s cooldown measured from the
                      channel's end, the gap between channels is now shorter
                      than the channel itself
VISUAL:               a thin unlit line between his hand and the target —
                      not a beam of light, a beam of absence, with the floor
                      beneath it going grey
FLAVOR:               Dying is not an event. It is a process with a rate,
                      and the rate can be adjusted by someone standing
                      nearby who knows how.

SKILL NAME:           Entropy Cascade
CLASS / TREE / TIER:  necromancer / Summons / tier_code 8
TYPE:                 stacking_dot
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 per cast (nearest below max stacks)
--- output ---
DAMAGE TIER:          low (8 per tick)
PACE:                 very fast (400ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               stacks to 6 on a single target
DOT:                  8 per 600ms for 5000ms, stacks to 6
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy below max stacks, so
                      it spreads across the swarm and tops up as stacks lapse
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1 maximum stack every 5th rank
--- identity ---
ENGINE:               feeds — a fully stacked cascade kills things without
                      the Necromancer's attention, and every death is Essence
COST:                 it takes five seconds of stacking before it is doing
                      real damage, and swarm enemies frequently die to
                      something else first. Against anything short-lived it
                      is entirely wasted throughput
VISUAL:               small motes of dark come away from the target and do
                      not fall; each stack adds another and they orbit
                      faster
FLAVOR:               Nothing he does here is destruction. He is only
                      declining, very precisely, to hold something together.

SKILL NAME:           Army of the Dead
CLASS / TREE / TIER:  necromancer / Summons / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns in a ring around the caster)
TARGETS:              n/a — 6 at once, ignoring caps, expiring after 20000ms
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               the six do not count against the skeleton cap and
                      cannot be re-raised; when they expire they expire
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (10+ within 400px), gated on 60 Essence
THREAT:               high (delegated across six bodies)
--- growth ---
RANK ADDS:            +10% army damage and HP per rank; +1 body every 5th
                      rank; +2s duration every 4th rank
--- identity ---
ENGINE:               consumes 60 Essence — the largest single spend in the
                      class, and the reason Essence has a 100 ceiling at all
COST:                 twenty-five seconds and sixty Essence for twenty
                      seconds of wall — at the capstone bucket the wall is
                      now up for most of its own cycle, and Essence is what
                      rations it rather than the clock. Fire it early and the
                      run's economy still never recovers. It is the only
                      skill in the class that genuinely punishes an auto-fire
                      trigger, and I have set the threshold high on purpose
VISUAL:               the whole floor goes at once — not a rising, a
                      surfacing, six of them shouldering up through the
                      ground in a ring facing outward
FLAVOR:               He does not remember all of their names. He remembers
                      that they had them, and he considers that the minimum
                      decency the arrangement allows.

---

## TREE: DARK MATTER

Role read: **the ranged DPS.** The only tree in the class that kills things
at speed and at distance. It is also the tree with no defensive node
whatsoever — a pure Dark Matter Necromancer has no summons to hide behind
and no bone to soak with, and dies to the first thing that reaches him.

---

SKILL NAME:           Dark Energy Blip
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (480px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 very fast (400ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (480px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage
--- identity ---
ENGINE:               neutral — but the fastest cycle in the class, so the
                      steadiest kill source, so the steadiest Essence
COST:                 eighteen damage. It is the tick-over of the class, and
                      by mid-run it is chip damage on a slot that could be
                      holding something that matters
VISUAL:               a fast dark bead with a faint violet halo, no trail
FLAVOR:               A small hole where a small amount of the world used to
                      be. It closes almost immediately. Almost.

SKILL NAME:           Dark Matter Bomb
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (420px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 medium (1500ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 420px
THREAT:               some
--- growth ---
RANK ADDS:            +5 damage; at rank 8 the impact splashes r60, +10px
                      splash every 4 ranks thereafter
--- identity ---
ENGINE:               neutral
COST:                 called a bomb, behaves like a bullet. Until rank 8 it
                      is a slower Blip with a bigger number, and there is a
                      real argument for skipping it
VISUAL:               a heavier, slower bead that visibly bends the light
                      around itself in transit
FLAVOR:               Weight without mass. He has tried to explain the
                      distinction twice and both listeners changed the
                      subject.

SKILL NAME:           Tainted Dark Matter
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (460px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 medium (1500ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               vulnerability — target takes +20% damage for 4000ms
                      (port addition, see COST)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — fires only at an enemy not already
                      tainted, so the debuff spreads rather than refreshing
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +2% vulnerability every 2nd rank
--- identity ---
ENGINE:               neutral
COST:                 lower damage than the Bomb one tier below it on a
                      longer cooldown. Everything it is worth is in the
                      debuff, and in a build with no follow-up damage the
                      debuff amplifies nothing
VISUAL:               the bead breaks on impact into a clinging violet
                      residue that keeps moving over the target's surface
FLAVOR:               Tainted is his word, not a technical one. What he
                      means is that some of it stays, and that what stays
                      remembers what it was for.

> **Port addition flagged:** "Tainted" has no rider in ToH — 22 damage on a
> 6s cooldown, strictly worse than the tier below. I gave it the
> vulnerability its name promises rather than raising its damage. Invention,
> flagged as such.

SKILL NAME:           Hex of Entropy
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (circle r70 at nearest)
RANGE:                range medium (360px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (4)
PACE:                 medium (1500ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.5 for 2000ms; weaken 40% for 2000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 360px
THREAT:               none
--- growth ---
RANK ADDS:            +400ms duration and +8px radius per rank (not damage —
                      four damage is the joke and it should stay the joke)
--- identity ---
ENGINE:               neutral
COST:                 RULING CONFLICT — HELD. It was the shortest control
                      window in the game on a seven-second cooldown, off five
                      times as often as on. At the medium bucket's 1.5s the
                      2000ms slow and 40% weaken never lapse, so the joke node
                      becomes permanent area control on a cluster. The two
                      seconds want to come down below the cooldown, or this
                      node wants a bucket the ruling does not offer
VISUAL:               a brief violet lattice snapping into place over a small
                      knot of enemies, then falling apart
FLAVOR:               A hex is a request that something proceed slightly
                      worse than it had intended to. It is rarely refused
                      and never resented, because nothing notices.

SKILL NAME:           Abyssal Blast
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (70° total)
RANGE:                range short (200px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (34)
PACE:                 medium (1500ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px — the cone orients to the
                      cluster centroid, not the nearest single enemy
THREAT:               some
--- growth ---
RANK ADDS:            +6 damage; +4° cone width every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 seventy degrees is narrow, and an auto-fired cone
                      resolves its facing at the instant of cast against a
                      swarm that is still moving. Expect it to catch fewer
                      enemies than the geometry promises
VISUAL:               a wedge of the room simply stops being lit, and
                      whatever was standing in it comes apart
FLAVOR:               He opened it once by accident and spent four years
                      learning to do it on purpose. He is fairly sure the
                      accident was not his.

SKILL NAME:           Dark Energy Rift
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r130 at 300px)
RANGE:                range medium (300px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 medium (1500ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px
THREAT:               none
--- growth ---
RANK ADDS:            +5 damage; +8px radius every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 placed at range with no lingering field — it resolves
                      once, where the cluster was. Against a fast-moving
                      swarm the placement lag costs it half its targets, and
                      unlike a hazard it does not get a second chance
VISUAL:               a disc of floor drops out of existence for a fraction
                      of a second and comes back with everything on it broken
FLAVOR:               The room is not as continuous as the room believes.

SKILL NAME:           Blight
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 6
TYPE:                 passive (aura)
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                ground area (circle on caster, always active)
RANGE:                range short (180px — verify against MainScene)
TARGETS:              uncapped in radius
--- output ---
DAMAGE TIER:          low (continuous)
PACE:                 n/a (continuous)
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "a chilling field
                      of dark matter surrounds you: it damages and slows
                      nearby enemies while unlocked"
DOT:                  yes — continuous field damage, magnitude in MainScene
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               some — it damages, so it accrues attention
--- growth ---
RANK ADDS:            +12px radius per rank (not damage, not magnitude)
--- identity ---
ENGINE:               feeds — the only skill in the class that kills without
                      being fired, so it produces Essence during the seconds
                      the player spends purely running
COST:                 it draws aggro continuously on a class that wants
                      enemies looking at its skeletons. Blight and Marrow
                      Skeleton are working against each other and the tree
                      does not tell you
VISUAL:               a low violet-black haze at knee height, thickest at
                      his feet, enemies inside it visibly slowing and
                      steaming
FLAVOR:               He stopped noticing it years ago. Everyone else
                      notices it immediately, and this is most of why he
                      lives where he lives.

SKILL NAME:           Internal Collapse
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 7
TYPE:                 stacking_dot
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 per cast (nearest below max stacks)
--- output ---
DAMAGE TIER:          low (10 per tick)
PACE:                 very fast (400ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               stacks to 5 on a single target
DOT:                  10 per 600ms for 3000ms, stacks to 5
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy below max stacks
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1 maximum stack every 5th rank
--- identity ---
ENGINE:               neutral
COST:                 a three-second window with a 400ms cycle now reaches
                      its own five-stack ceiling comfortably, which is the
                      pace pass quietly fixing the node's whole complaint. It
                      is still the more fragile of the class's two stacking
                      DoTs and it still sits three tiers higher
VISUAL:               the target's outline pulls inward slightly with each
                      stack, as though something behind it is taking up slack
FLAVOR:               Nothing is added. That is what he finds elegant about
                      it. The shape simply discovers that it has been
                      supporting itself on nothing for some time.

SKILL NAME:           Dark Energy Beam
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 8
TYPE:                 channel
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                beam
RANGE:                range medium (360px)
TARGETS:              1 (locks nearest)
--- output ---
DAMAGE TIER:          low (16 per tick)
PACE:                 slow (3000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               does NOT break on movement (port ruling 4, and roster
                      ruling 5); 60% tick rate while moving; breaks on target
                      death or leaving range. Cooldown runs from the channel's
                      END, as Death Channel's does
DOT:                  16 per 500ms for up to 10000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 360px
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage per tick; +1s maximum duration every 4th rank
--- identity ---
ENGINE:               neutral — unlike Death Channel, this one does not
                      generate Essence per tick. The Summons tree pays you
                      for channelling; this tree just does damage
COST:                 the highest sustained single-target output in the
                      class, aimed at one enemy, while forty others walk
                      toward you. In a boss room it is the best skill the
                      Necromancer owns; in a swarm room it is a mistake
VISUAL:               a wide unlit column, edges fraying, the target lit
                      only by what is coming off it
FLAVOR:               Not a beam of anything. A sustained argument that the
                      space between them should not be occupied, and he is
                      better at arguing than most things are at existing.

SKILL NAME:           Singularity
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r200 at 200px)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          high (176 across 8 pulses; 22 per pulse) — read off
                      the total, not the pulse. No number changed: the tier
                      label was wrong, and it is what gives Dark Matter the
                      high-tier node ruling 2 requires
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               pull — each pulse drags every enemy in r200 up to 14px
                      toward the centre
DOT:                  22 per pulse, 8 pulses
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px), gated on 40 Essence
THREAT:               none
--- growth ---
RANK ADDS:            +4 damage per pulse; +2px pull per pulse every 3rd
                      rank; +1 pulse every 5th rank
--- identity ---
ENGINE:               consumes 40 Essence
COST:                 it gathers the swarm into a single dense point 200px
                      from a caster made of paper. Played well it is the best
                      skill in the class — everything the Necromancer owns
                      does more damage to a pile. Played badly it is a
                      twenty-five-second cooldown spent building the exact
                      thing that kills him, and at the capstone bucket that
                      mistake now recurs twice as often
VISUAL:               a fixed black point that does not grow; the floor
                      texture streams toward it in visible lines and enemies
                      lean before they slide
FLAVOR:               He is not making a hole. Holes are an absence of
                      material. He is making a place where the arrangement
                      of things has agreed to stop being negotiable.
