# NECROMANCER — RUMBLEJAM CONVERSION (30 skills)

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
against Marrow Skeleton). It carried 31 blocks rather than 30 for that reason;
it now carries 30, because the Dark Matter summon is cut and the branch pair's
exclusivity is itself unresolved — see CONFLICTS.

Linear-with-one-branch and four-pairs-per-tree are incompatible shapes and
picking one renumbers every tier in the file. **Not resolved here** — it is a
roster-wide decision, it affects all fourteen documents, and it cannot be
settled in a documents-only pass because the built shape lives in `js/`.

---

## ROSTER RULING APPLIED

Against `roster-ruling-pace-damage-engines.md`. What moved, what held.

**Pace (ruling 1).** 21 of 22 timed actives rebucketed, then rescaled again
when the bucket table was retuned against the corrected activation-rate gap.
Grasp of Death is held — see below. Distribution: Dark Matter passes on its own
(7 medium-or-faster, 0 very slow), Marrow passes (Stake promoted, its root cut
under ruling 6), Summons **cannot pass** — see below.

**Rate: 9.17/sec on a spread build, against a 6–9 target — ABOVE the target.** Held open pending playtest rather than corrected; see Ruling 1.
The bucket-mix rule took this class from 8.75 by demoting Internal Collapse
(Dark Matter held two very-fast nodes; Blip keeps the slot as the tier-1
opener). It did not close the gap, and the reason is arithmetic in the rule
rather than anything in this class: **at most 1 very-fast per tree means 3 per
class**, and a spread build takes all three. 3 × 1.667/sec is 5.0/sec before a
single other slot is filled.

At the raised floor of 3 fast-or-better this class reads 9.17/sec, and the cause
is unchanged: **at most 1 very-fast per tree means 3 per class**, and this class
uses its whole allowance. Each very-fast node is worth 0.83/sec more than a fast
one, so 0 gives 6.67, 1 gives 7.50, 2 gives 8.33 and 3 gives 9.17. **A per-CLASS
ceiling of 1 very-fast would put every class in the roster between 6.67 and
7.50.** Reported, not applied — it is a change to the rule.

**Mono-tree: 5.25/sec (Dark Matter), below band.** Marrow and Summons cannot
fill eight slots at all — 7 and 6 timed actives against 8 slots, so a single-tree
Necromancer is not merely slow, it is short of skills.

**Damage share (ruling 2).** Marrow 6 damage nodes, 1 high. Dark Matter 10
damage nodes, and its high-tier node comes from relabelling Singularity off
its 8-pulse total rather than its per-pulse figure — no number changed, and
ruling 2 could not otherwise be met without retuning, which the ruling's own
"out of scope" clause forbids. Summons has 6 and passes, under the rewritten
ruling 2 that counts a summon's damage as the node's damage.

**Passive budget (ruling 4).** Nine passives across the class against a
four-slot budget: Marrow 3, Summons 5, Dark Matter 1. Binding, and worth
stating plainly — **a pure Summons build cannot slot its own passive set**,
so Unyielding Beast, Necrotic Presence, Tentacles and the skeleton branch
compete against each other for four of the class's slots.

**Channels (ruling 5).** Already compliant — port ruling 4 wrote the 60%
moving tick before the roster ruling existed. One clarification added: for
Death Channel and Dark Energy Beam the cooldown now runs from the channel's
END, since either skill's own cooldown — Death Channel's fast 1.2s, Dark
Energy Beam's slow 4s — otherwise sits under a 10s channel.

**Engine cost (ruling 3).** Not applicable. Essence is a bank that builds, not
one of the two depleting engines.

### THE RULING AGAINST THE CLASS — two resolved since, two still held

**RESOLVED by roster ruling 6 (rider duration under cooldown).** Reported from
this class, ruled roster-wide, applied back here. Stake's root went 2500ms to
1000ms and Hex of Entropy's slow and weaken went 2000ms to 1000ms — both now
sit under a 1500ms cooldown, and both gained uptime doing it: Stake pins 67% of
the time against 25% before, Hex 67% against 22%.

**RESOLVED by the reword of ruling 2 (summon damage counts).** Summons has six
damaging nodes once a summon's output counts as the node's output, and passes.

**STILL HELD 1 — Marrownaut is a form the exception cannot ration.** Ruling 6
says a form keeps its duration and takes a capstone cooldown. Applied, at the
bucket's 30s ceiling. A 30000ms form under a 30000ms cooldown is still
permanent. The exception works for a 12s form under a 60s capstone; it cannot
ration a form whose duration equals the bucket's entire range.

**STILL HELD 2 — Summons cannot satisfy the DISTRIBUTION rule and stay a
summoner tree.** Five passives plus a capstone leave four timed actives, of
which four must be medium-or-faster. Two are. The other two are Unleash the
Monster and Death Channel — a single pet and a ten-second channel. A skeleton
every 0.4s is not a commander, and a channel on a cooldown shorter than itself
is not a channel. The damage half of this was fixed by rewording ruling 2; the
pace half has no equivalent reading. **Cutting the Dark Matter summon made this
worse rather than better**: it removed one of the three offending actives and
one of the tree's timed nodes at the same time, so the ratio is unchanged and
the tree is a node shorter.

**STILL HELD 3 — Grasp of Death is a capstone the capstone bucket destroys.**
Marrow's tier-10 and the class's only self-heal: 40 damage on a 60% drain,
currently 9s. The capstone bucket's 20–30s removes the Necromancer's sustain;
the slow bucket's 4s makes a 24-point drain-heal available fifteen times a
minute. Held at 9s, in no bucket, deliberately.

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
- Summon Skeleton: **10** · Unleash the Monster: **30**
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
1 (never more — it is a pet, not a swarm). Army of the Dead spawns 6 at once
on a 60s cooldown, ignoring caps,
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

## MERGE PROVENANCE

This file is the reconciliation of two divergent Necromancer conversions.
Neither contained the other. The archived source of each is kept verbatim at
`docs/design/toh/necromancer.md`; this is the merged, live document.

| what | taken from | why |
|---|---|---|
| `PRIMITIVE:` on every node | the archive, **corrected against the engine** | only the archive had the field; a third of its values were wrong (below) |
| the OPEN ITEMS section | the archive | live questions, re-checked against what has since shipped |
| pace and cooldown values | this document's previous revision | the roster-ruling pass |
| `## ROSTER RULING APPLIED` | this document's previous revision | records that the pass happened |
| the tree ruling, the engine, the port rulings | this document's previous revision | longer and later |
| Stake as a 360px projectile | the archive | Casey's explicit ruling; **not yet built** |
| the Dark Matter summon, cut | the archive | Casey's explicit ruling; the class is 30 skills |
| Marrow node order, Marrownaut, Quill, the opener set | **the shipped engine** | the engine wins on structure |

### The archive's primitive classification was stale, and not in one direction

It is the only source for the field and it could not simply be copied. Eleven of
its thirty values disagree with what ships:

- **`NEEDS aura`, `NEEDS channel`, `NEEDS gravity_pull` are all satisfied.** All
  three primitives exist and ship. The archive was written when they did not.
  Blight uses the aura mechanism, Death Channel and Dark Energy Beam are
  `channel`, and Singularity is `hazard + gravity_pull`.
- **`nova` and `mortar` are not primitives.** The engine has no such kinds and
  never did. Bone Nova ships as `strike`; Hex of Entropy and Dark Energy Rift
  ship as `hazard`.
- **`none` was wrong three times.** Calcify is `passive { armorGrit, armorVit }`,
  Bone Spur is an active `ward`, and Marrownaut is `persist`.

Every `PRIMITIVE:` line in this file now names what the code actually runs. A
line reading `NEEDS <x>` means the engine genuinely lacks it; there are none
left in this class.

### Changed because the engine disagreed — every one, named

Neither source document reflects work that has since shipped. Nine changes were
made against the code rather than against either document. None was made
silently.

| # | what changed | was (both documents) | is (shipped) |
|---|---|---|---|
| 1 | **Marrow node order** | Bone Dart, Spiked Punch, Bone Nova, Calcify, Marrownaut, Stake, Osteo Aura, Bone Spur, Wrecking Ball, Grasp of Death | Spiked Punch, Marrownaut, Bone Dart, Bone Nova, Stake, Quill, Bone Spur, Wrecking Ball, Grasp of Death, Calcify |
| 2 | **unlock levels** | not stated | stated per node; they move with tier — 1, 3, 5, 8, 11, 15, 19, 24, 30, 36 |
| 3 | **Marrownaut** | a 30s-cooldown panic form on `SELF_HP_BELOW_X 45%`, lasting 10–30s, growing the caster's hitbox | a persistent slotted state: no trigger, no cooldown, no duration, no size change |
| 4 | **Quill** | absent from both; Osteo Aura sat at this tier | built at Marrow tier 6, written here from behaviour |
| 5 | **the Summons opener** | Summon Skeleton | **Entropy Cascade**; Summon Skeleton moved to tier 2 |
| 6 | **the class's opening three** | Bone Dart / Dark Energy Blip / Summon Skeleton | **Spiked Punch / Dark Energy Blip / Entropy Cascade** — Bone Dart is no longer an opener in any tree |
| 7 | **Bone Spur** | a passive reflect | an active `ward` (the previous revision already flagged this; it is now on the node) |
| 8 | **Summons tier 8** | occupied | empty in code; Death Channel sits at tier 9 |
| 9 | **Bone Dart's prose** | said "400ms" beside a `PACE` line reading 600ms | 600ms throughout; the code agrees with the `PACE` line |

**One change went the other way.** Stake is documented as a 360px projectile on
Casey's ruling and ships as an 84px melee `strike`. It is the only deliberate
disagreement in the file and it is marked on the node.

---

## TREE: MARROW

Role read: **the off-tank.** The tree that lets a summoner survive the
moment his summons are dead. Bone Spur reflects, Calcify and Marrownaut
absorb, Grasp of Death is the only self-heal in the class. Solo this tree is
mandatory; in co-op it is what a Necromancer takes when nobody else will
hold the line.

---

SKILL NAME:           Spiked Punch
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 0  (built tier 1, unlocks at level 1)
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r72)
RANGE:                melee short (72px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 fast (1200ms)
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
PRIMITIVE:            strike

SKILL NAME:           Marrownaut
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 1  (built tier 2, unlocks at level 3)
TYPE:                 active (persistent — occupies a slot, never fires)
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (a field follows the caster while it holds)
RANGE:                n/a
TARGETS:              self; the field takes every enemy inside it
--- output ---
DAMAGE TIER:          none (0) — and the zero is load-bearing, see COST
PACE:                 n/a — NO COOLDOWN, NO TRIGGER, NO DURATION
DOMAIN:               spiritual
--- effects ---
RIDERS:               persistent while slotted:
                      · form "marrownaut" — +20 Defense, +40 Vitality, −3 Speed
                      · a 165px field around the caster, pulsing every 800ms,
                        pulling enemy attention onto him and dealing NOTHING
                      · an absorb shield, scaling with `armor`, recomputed at
                        the moment of slotting so the form's own Defense is
                        already in it
                      · teardown on un-slot: form, field and shield all go
DOT:                  none
AFFECTS:              self; enemies (attention only)
--- automation ---
TRIGGER:              none. It is not in the trigger loop at all
THREAT:               high, continuous — the pull is the skill
--- growth ---
RANK ADDS:            +absorb per rank (the shield is the only figure that
                      moves). The form's stats, the field's radius and the
                      pulse interval are flat at every rank
--- identity ---
ENGINE:               neutral on Essence, and the only node in the game that
                      reads `armor` — the class engine's one consumer. The
                      shield is taken AFTER the form lands, so the +20 Defense
                      is inside the number
COST:                 a slot, permanently, for a skill that never fires. That
                      is the whole decision: slotting Marrownaut is the choice
                      to tank, and it is paid once rather than on a cooldown.
                      The −3 Speed is the running cost. **The zero damage is
                      not an oversight** — a permanent aggro field that also
                      dealt damage would clear rooms while the player stood
                      still, which is the failure the statue test exists to
                      catch. It drags the room onto itself and kills none of it
VISUAL:               he swells — the skeleton visibly thickening beneath,
                      plates of bone shouldering up through the coat, half a
                      head taller and much wider, and it does not subside
FLAVOR:               The armour was always in there. Getting into it is
                      simply a matter of persuading the body that its own
                      frame belongs on the outside.
PRIMITIVE:            persist { form, stats, aura, shield }  — not `form`

> **REWRITTEN AGAINST THE SHIPPED ENGINE.** Both source documents describe a
> timed panic button: `SELF_HP_BELOW_X 45%`, a 30s cooldown, a form lasting
> 10–30s, and a caster size increase. None of that is what ships. Marrownaut
> is now a persistent state entered by putting it in the bar and left by taking
> it out, and the tree's identity rather than its emergency.
>
> **The size change is gone.** It was the node's most-discussed idea and the
> thing both documents flagged; the shipped form changes stats only. Recorded
> here because a reader of either source document will come looking for it.
>
> **`persist` is a third door into the sheet**, beside `compose` and `passive`,
> and Marrownaut is the first skill through it. Any other node written as "a
> state you hold while it is slotted" uses the same shape.

SKILL NAME:           Bone Dart
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 2  (built tier 3, unlocks at level 5)
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (460px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 very fast (600ms)
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
ENGINE:               neutral — but at 600ms it produces kills, and kills
                      are Essence
COST:                 single target on a 600ms cycle is a rifle in a game
                      about crowds. It will out-damage everything early and
                      fall behind hard by the time enemies arrive twelve at
                      a time
VISUAL:               a splinter of bone leaves his hand flat and fast, no
                      arc, a dry crack on impact
FLAVOR:               He does not carry ammunition. He is, at all times,
                      carrying two hundred and six pieces of it, and has
                      long since stopped thinking of them as his.
PRIMITIVE:            bolt

SKILL NAME:           Bone Nova
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 3  (built tier 4, unlocks at level 8)
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r165 on caster)
RANGE:                range short (165px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
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
PRIMITIVE:            strike

SKILL NAME:           Stake
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 4  (built tier 5, unlocks at level 11)
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (14)
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               root 1400ms — port addition; cut from an authored
                      2500ms by roster ruling 6 (70% of the 2s cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (360px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +150ms root every 3rd rank (was +300ms —
                      rescaled with the shorter base so ranking cannot walk
                      the root back above the cooldown)
--- identity ---
ENGINE:               neutral
COST:                 promoted from slow to medium (10s to 2s) because Marrow
                      needs a fourth medium-or-faster node and this was the
                      tree's weakest by its own former reckoning. Ruling 6 took
                      the root from 2500ms to 1400ms to keep it under the
                      cooldown. The node is better for it: 1.4s of pin every 2s
                      is 70% uptime against the old 2500ms every 10s, which was
                      25%. It pins more and locks less. **Ranged, per Casey's
                      ruling** — as a melee node it asked the Necromancer to be
                      within 84px to pin the thing he was running from, which
                      is the position the pin exists to avoid
VISUAL:               a length of yellowed bone launched flat and hard,
                      punching through the foot and into the floor; it snaps
                      when they tear free
FLAVOR:               A stake is not a weapon. It is a statement about where
                      something is going to remain.
PRIMITIVE:            bolt

> **Port addition flagged:** ToH's Stake has no rider — 14 damage on a 10s
> cooldown and nothing else, which is a dead node in a game where slots are
> scarce. A 2.5s root was added rather than inflating the damage, because
> "pin something in place" is what the name and animation already promise.
> This is invention, not derivation. Cut it and the skill should probably
> be cut too.

> **RULED BUT NOT BUILT — this block is ahead of the engine.** Casey ruled Stake
> ranged and this document carries the ruling, but `necro_stake` still ships as
> a melee `strike`: `ENEMY_BREACHES_RING` at 84px, an 84px reach, a 6.28 arc and
> a cap of three targets. Damage (14), cooldown (2000ms) and root (1400ms) all
> match; only the delivery does not. Building it means `NEAREST_IN_RANGE` at
> 360px and a `bolt` step in place of the `strike`. **This is the one place in
> the document that deliberately disagrees with shipped code**, and it is
> recorded rather than reconciled because the ruling is the newer fact.

SKILL NAME:           Quill
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 5  (built tier 6, unlocks at level 15)
TYPE:                 passive
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              1 (whatever struck the ward)
--- output ---
DAMAGE TIER:          n/a — its output is a fraction of what it absorbs
PACE:                 n/a
DOMAIN:               spiritual
--- effects ---
RIDERS:               reflects 0.4% of ABSORBED damage back per point of
                      Defense. It reads Defense as it moves rather than
                      freezing at cast, and the returned fraction is capped
                      at 100%
DOT:                  none
AFFECTS:              enemies, self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a passive slot)
THREAT:               none
--- growth ---
RANK ADDS:            +reflect fraction per point of Defense per rank
--- identity ---
ENGINE:               feeds — a reflect kill is the caster's kill, and a
                      caster's kill is +5 Essence
COST:                 **it does nothing without a ward up.** The fraction is
                      added to the ward's own return and applied to damage the
                      ward absorbs; with no ward there is nothing to take a
                      fraction of. The class's only ward is Bone Spur, one tier
                      above it, so Quill is a node that pays a node the player
                      has not bought yet. It is also the second Marrow node
                      whose value is a function of Defense — Marrownaut's +20
                      is 8% more ward reflect on its own — so the tank build
                      compounds and the caster build gets nothing at all
VISUAL:               where a blow is stopped, a short spine comes out through
                      the block and goes back the way the blow came
FLAVOR:               The harder your shell, the worse it is to strike.
PRIMITIVE:            passive { reflectPerGrit }

> **NOT IN EITHER SOURCE DOCUMENT.** `necro_quill` ships at Marrow tier 6 and
> neither conversion describes it — both put Osteo Aura there instead. This
> block is written from the code, and it is the one node in the file with no
> conversion heritage at all: its judgment fields are authored against
> behaviour rather than carried across from Thrones of Heaven.
>
> Osteo Aura is kept below, tabled, exactly as the previous revision left it.

SKILL NAME:           Bone Spur
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 6  (built tier 7, unlocks at level 19)
TYPE:                 passive
AXIS POSITION:        7 (of 10)
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
PRIMITIVE:            ward

SKILL NAME:           Wrecking Ball
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 7  (built tier 8, unlocks at level 24)
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (320px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (28)
PACE:                 slow (4000ms)
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
PRIMITIVE:            line

SKILL NAME:           Grasp of Death
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 8  (built tier 9, unlocks at level 30)
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target (nearest)
RANGE:                melee long (120px)
TARGETS:              1
--- output ---
DAMAGE TIER:          high (40)
PACE:                 slow (4000ms)
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
PRIMITIVE:            drain

SKILL NAME:           Calcify
CLASS / TREE / TIER:  necromancer / Marrow / tier_code 9  (built tier 10, unlocks at level 36)
TYPE:                 passive
AXIS POSITION:        10 (of 10)
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
PRIMITIVE:            passive { armorGrit, armorVit }

### TABLED — kept as a proposal, not part of the built tree

SKILL NAME:           Osteo Aura   [TABLED — see the note above]
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
COST:                 it is the summoner keystone, and it costs a slot on the
                      survival tree to get it. Summons count as "you", so the
                      field amplifies about four-fifths of what the class
                      actually deals — but only inside 180px of him, which
                      means the Necromancer has to stand where his skeletons
                      are fighting. A summoner who kites is a summoner whose
                      keystone is switched off
VISUAL:               a dim bone-white circle on the floor; enemies inside it
                      look thinner, their outlines showing structure
FLAVOR:               Everything alive is a wall built around a frame. He
                      finds it very hard to stop noticing where the frame is.
PRIMITIVE:            aura  — the primitive exists; the tree slot does not

> **RESOLVED by measurement, and the narrow reading was wrong.** The declared
> text says "+25% damage from you," and this block used to read that as the
> caster only, with a COST line saying a pure summoner build got nothing from
> it. Measured at level 82 in a region-8 room, summons are **69-94% of what
> this class deals** — 94.1% on a representative build. Filtered to what lands
> inside the field:
>
> | reading | share amplified | effective damage gain |
> |---|---|---|
> | caster only | 5.9% | **+1.5%** |
> | summons count | 80.7% | **+20.2%** |
>
> Thirteen and a half times. And under the narrow reading the node's entire
> rank progression is inert: RANK ADDS is radius and only radius, the caster
> stands at his own centre, and caster damage inside the circle measured
> **537 at r180 and 537 at r276** — eight ranks buying nothing. That is not a
> weak node, it is a broken one.
>
> Counting summons is also the free reading in code: the amplification keys on
> `attacker.idx`, and the minion facade carries the owner's index by design, so
> excluding them would take an extra clause. **Ruled: summons count.** Neither
> middle — a split rate, or a rank-gated value — was taken; both are tuning on
> top of a decision, and either is one number away if playtest disagrees.

## TREE: SUMMONS

Role read: **the commander, and the class's answer to every role at once.**
Skeletons are the tank. The Monster is the DPS. The Necromancer behind them
is the healer, in the only sense RumbleJam allows: he replaces bodies faster
than they break. Threat ladder: Monster > Skeletons > you. This is the tree
that makes a solo Necromancer feel like a five-man group.

---

SKILL NAME:           Entropy Cascade
CLASS / TREE / TIER:  necromancer / Summons / tier_code 0  (built tier 1, unlocks at level 1)
TYPE:                 stacking_dot
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 per cast (nearest below max stacks)
--- output ---
DAMAGE TIER:          low (8 per tick)
PACE:                 very fast (600ms)
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
PRIMITIVE:            plague

SKILL NAME:           Summon Skeleton
CLASS / TREE / TIER:  necromancer / Summons / tier_code 1  (built tier 2, unlocks at level 3)
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 3 standing, +1 per 4 ranks
--- output ---
DAMAGE TIER:          none (0) — the skeleton deals the damage, not the cast
PACE:                 fast (1200ms)
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
PRIMITIVE:            summon

SKILL NAME:           Unleash the Monster
CLASS / TREE / TIER:  necromancer / Summons / tier_code 2  (built tier 3, unlocks at level 5)
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 1, always
--- output ---
DAMAGE TIER:          none (0) — the Monster deals 26 per swing / 1100ms
PACE:                 very slow (8000ms)
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
PRIMITIVE:            summon

SKILL NAME:           Unyielding Beast
CLASS / TREE / TIER:  necromancer / Summons / tier_code 3  (built tier 4, unlocks at level 8)
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
PRIMITIVE:            passive { summonHp }

SKILL NAME:           Necrotic Presence
CLASS / TREE / TIER:  necromancer / Summons / tier_code 4  (built tier 5, unlocks at level 11)
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
PRIMITIVE:            passive { summonDmg, summonHp }

SKILL NAME:           Blood Skeleton
CLASS / TREE / TIER:  necromancer / Summons / tier_code 5  (built tier 6, unlocks at level 15)
TYPE:                 passive
AXIS POSITION:        6 (of 10)
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
PRIMITIVE:            passive { summonDmg }

SKILL NAME:           Marrow Skeleton
CLASS / TREE / TIER:  necromancer / Summons / tier_code 5  (built tier 6, unlocks at level 15)
TYPE:                 passive
AXIS POSITION:        6 (of 10)
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
PRIMITIVE:            passive { summonHp }

> **Role fork note:** this is the clearest tank-versus-DPS choice in the
> game and it is already in your code. In co-op, Marrow Skeleton is a real
> tank spec — the Necromancer's skeletons peel for the whole party. Solo,
> Blood Skeleton is usually correct. I'd protect this pair carefully; it's
> a model for how the other thirteen classes could express role choice
> without adding systems.

SKILL NAME:           Tentacles of Dark Matter
CLASS / TREE / TIER:  necromancer / Summons / tier_code 6  (built tier 7, unlocks at level 19)
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
PRIMITIVE:            passive { summonDmg }

SKILL NAME:           Death Channel
CLASS / TREE / TIER:  necromancer / Summons / tier_code 8  (built tier 9, unlocks at level 30)
TYPE:                 channel
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                beam
RANGE:                range medium (360px)
TARGETS:              1 (locks nearest)
--- output ---
DAMAGE TIER:          low (14 per tick)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               does NOT break on movement (port ruling 4, and roster
                      ruling 5); ticks at 60% rate while the caster is moving;
                      breaks on target death or leaving 360px. The cooldown
                      runs from the moment the channel ENDS, not from the cast
                      — its own fast 1.2s sits under a 10s channel, and
                      any other reading makes the cooldown meaningless
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
                      doing their job. At a 1.2s cooldown measured from the
                      channel's end, the gap between channels is now shorter
                      than the channel itself
VISUAL:               a thin unlit line between his hand and the target —
                      not a beam of light, a beam of absence, with the floor
                      beneath it going grey
FLAVOR:               Dying is not an event. It is a process with a rate,
                      and the rate can be adjusted by someone standing
                      nearby who knows how.
PRIMITIVE:            channel

SKILL NAME:           Army of the Dead
CLASS / TREE / TIER:  necromancer / Summons / tier_code 9  (built tier 10, unlocks at level 36)
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
PRIMITIVE:            summon

## TREE: DARK MATTER

Role read: **the ranged DPS.** The only tree in the class that kills things
at speed and at distance. It is also the tree with no defensive node
whatsoever — a pure Dark Matter Necromancer has no summons to hide behind
and no bone to soak with, and dies to the first thing that reaches him.

---

SKILL NAME:           Dark Energy Blip
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 0  (built tier 1, unlocks at level 1)
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (480px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 very fast (600ms)
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
PRIMITIVE:            bolt

SKILL NAME:           Dark Matter Bomb
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 1  (built tier 2, unlocks at level 3)
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (420px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 fast (1200ms)
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
PRIMITIVE:            bolt

SKILL NAME:           Tainted Dark Matter
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 2  (built tier 3, unlocks at level 5)
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (460px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 medium (2000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               vulnerability — target takes +20% damage for 1400ms
                      (port addition, see COST) — roster ruling 6:
                      4000ms→1400ms (70% of the 2000ms cooldown)
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
PRIMITIVE:            bolt

> **Port addition flagged:** "Tainted" has no rider in ToH — 22 damage on a
> 6s cooldown, strictly worse than the tier below. I gave it the
> vulnerability its name promises rather than raising its damage. Invention,
> flagged as such.

SKILL NAME:           Hex of Entropy
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 3  (built tier 4, unlocks at level 8)
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (circle r70 at nearest)
RANGE:                range medium (360px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (4)
PACE:                 medium (2000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.5 for 1400ms; weaken 40% for 1400ms — both cut
                      from an authored 2000ms by roster ruling 6
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 360px
THREAT:               none
--- growth ---
RANK ADDS:            +200ms duration and +8px radius per rank (was +400ms,
                      rescaled under ruling 6; not damage — four damage is the
                      joke and it should stay the joke)
--- identity ---
ENGINE:               neutral
COST:                 it was the shortest control window in the game on a
                      seven-second cooldown, off five times as often as on. At
                      the medium bucket it is one second in every 1.5 — still
                      the shortest window in the game, now at 67% uptime
                      instead of 22%. Ruling 6 is what keeps it from becoming
                      permanent, and four damage is still the joke
VISUAL:               a brief violet lattice snapping into place over a small
                      knot of enemies, then falling apart
FLAVOR:               A hex is a request that something proceed slightly
                      worse than it had intended to. It is rarely refused
                      and never resented, because nothing notices.
PRIMITIVE:            hazard

SKILL NAME:           Abyssal Blast
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 4  (built tier 5, unlocks at level 11)
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (70° total)
RANGE:                range short (200px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (34)
PACE:                 medium (2000ms)
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
PRIMITIVE:            cone

SKILL NAME:           Dark Energy Rift
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 5  (built tier 6, unlocks at level 15)
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r130 at 300px)
RANGE:                range medium (300px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 medium (2000ms)
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
PRIMITIVE:            hazard

SKILL NAME:           Blight
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 6  (built tier 7, unlocks at level 19)
TYPE:                 passive (aura)
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                ground area (circle on caster, always active)
RANGE:                range short (180px — verify against MainScene)
TARGETS:              uncapped in radius
--- output ---
DAMAGE TIER:          low (30 per pulse)
PACE:                 n/a (continuous) — but the FIELD pulses every 4200ms
DOMAIN:               spiritual
--- effects ---
RIDERS:               a chilling field of dark matter surrounds you, r120,
                      pulsing every 4200ms for 30 damage and slowing what it
                      catches to x0.7 for 800ms. The gap is the mechanic, not
                      a compromise: built as a continuous field this let a
                      never-moving Necromancer clear 20 of 25 statue rooms, and
                      at 1 dps it still broke 12 — no magnitude fixes it,
                      because time does the work. See ruling 7
DOT:                  30 per 4200ms pulse — the magnitude was never in
                      MainScene; the built game has carried it since phase 1
                      (js/content/skills/necro_dark_matter.js). 4200ms is this
                      node's own former cooldown: the rate the player could
                      cast it is now the rate it fires itself
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
PRIMITIVE:            passive { aura }

SKILL NAME:           Internal Collapse
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 7  (built tier 8, unlocks at level 24)
TYPE:                 stacking_dot
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 per cast (nearest below max stacks)
--- output ---
DAMAGE TIER:          low (10 per tick)
PACE:                 fast (1200ms)
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
PRIMITIVE:            plague

SKILL NAME:           Dark Energy Beam
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 8  (built tier 9, unlocks at level 30)
TYPE:                 channel
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                beam
RANGE:                range medium (360px)
TARGETS:              1 (locks nearest)
--- output ---
DAMAGE TIER:          low (16 per tick)
PACE:                 slow (4000ms)
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
PRIMITIVE:            channel

SKILL NAME:           Singularity
CLASS / TREE / TIER:  necromancer / Dark Matter / tier_code 9  (built tier 10, unlocks at level 36)
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
PRIMITIVE:            hazard + gravity_pull

---

## CONFLICTS — BOTH READINGS DELIBERATE, CASEY RULES

Not split, not averaged, not quietly resolved. Each is a place where the two
source documents disagree and each side has an argument.

### 1. Is the skeleton branch pair exclusive?

| | reading | what it costs |
|---|---|---|
| **the archive** | **not exclusive.** A player may take Blood Skeleton and Marrow Skeleton both, and pays two of four passive slots to be a generalist | half the passive budget on one fork. The other three Summons passives — Unyielding Beast, Necrotic Presence, Tentacles — then compete for the remaining two slots |
| **the previous revision** | **exclusive.** One arm or the other, and the choice is the class's role fork | one passive slot, and a real decision. But the "role fork" only reads as a fork if the engine refuses both |

**What ships:** both nodes sit at built tier 6 with the same prerequisite and
nothing in the loader refuses the pair, so **the engine currently behaves as
"not exclusive"** — by absence rather than by decision.

**What each implies.** Exclusive makes the Necromancer the one class with a
declared spec choice, and the previous revision leans on that: it is cited as
"a model for how the other thirteen classes could express role choice without
adding systems." Non-exclusive makes the passive budget the limiter instead,
which is the roster-wide mechanism ruling 4 already established, and needs no
new machinery. **The two readings also disagree about the class's node count**
— exclusivity is why the previous revision carried 31 blocks rather than 30.

### 2. Where does Osteo Aura go, if anywhere?

The previous revision's tree ruling says "Osteo Aura and Grasp of Death replace
Quill and Banshee's Wail." **Half of that shipped**: Grasp of Death is built at
Marrow tier 9. The other half did not — Quill is built at tier 6 and Osteo Aura
does not exist in code.

The previous revision then tabled Osteo Aura rather than deleting it, on the
grounds that Marrow already holds ten nodes. That table is kept. The question it
leaves open is unchanged and is Casey's: **Osteo Aura needs a slot, and taking
one means naming the node it displaces.** The mechanism it wants is built.

### 3. Tree shape, still open and still roster-wide

Carried forward unresolved from the previous revision. The built Marrow and
Summons trees are **branching**; this document is linear with one branch pair.
Picking either renumbers every tier in all fourteen files. Unchanged by this
merge.

---

## RECORDED, NOT ACTED ON

### The summon taunt split — ruled, scheduled, not implemented

**Casey's ruling: DPS summons should not taunt. Defensive summons should.**
Filed as KNOWN-DEFECTS #30 and deliberately left unbuilt.

Three summons in the game taunt on their own attack, which is what makes the
minion rather than its owner the thing an enemy is sent at. Two of the three are
this class's:

| summon | taunt | tree |
|---|---|---|
| skeleton | 1600 ms | Summons |
| the Monster | 3000 ms | Summons |
| druid bear | 2200 ms | (Druid) |

**Why it is live from the moment Marrownaut is slotted.** Marrownaut's pull is a
persistent field and resolves third in the targeting order; a summon's taunt is
a cast effect and resolves first. A Necromancer running Marrow-tank plus Summons
has both, and they alternate — the skeleton wins its 1600 ms window, the field
reclaims the enemy between windows, and aggro oscillates for as long as both are
on the field. **The precedence is correct and deliberate**: a taunt somebody cast
must beat a state somebody is merely in. The oscillation is the ruling's absence,
not the precedence's fault.

### The `bonelord` trait, and what Marrownaut's permanence did to it — UNRULED

`bonelord` is the Necromancer's **character trait**, and it is a different thing
from the Marrow skill that shares a name. The character carries no weapons and
four summon mounts instead; fuse all four into one and the result is called the
Marrownaut, and while it stands the player is meant to gain **100% of its
Defense and 50% of its Vitality**.

**The Vitality half does what it says.** Measured: a fused mount with 200 max HP
puts +100 Vitality on the sheet, once, and it stays put.

**The Defense half reads the wrong number, and Marrownaut-the-skill has just
made that matter.** The term takes the *player's* Defense rather than the
*mount's*, and adds it back to the player. Until now that multiplied zero — the
Necromancer's base Defense is 0, so the term was inert and nobody could see it.
Marrownaut-the-skill puts +20 Defense on the sheet permanently. Measured, with
the form slotted and one fused mount standing, Defense over eight successive
stat recomputations:

    20 → 40 → 60 → 80 → 100 → 120 → 140 → 160 → 180 …

It does not converge and there is no ceiling. Each recomputation adds the sheet's
current Defense to itself, so the growth continues for as long as both the form
is slotted and the fused mount is alive — which, now that the form is permanent,
is the rest of the run.

**Two separate faults in one term:** it reads the wrong body's Defense, and
reading the player's makes the term its own input. Reproduce with
`node tools/bonelord_probe.mjs`. **Not fixed here** — recorded, unruled, and
flagged as the most consequential thing this merge turned up.

---

## OPEN ITEMS

Live questions. Re-checked against what has shipped since the archive was
written; three of the archive's items are now closed and are marked as such.

- **`NEEDS aura`** — ~~Osteo Aura, Blight~~. **CLOSED.** The aura mechanism ships
  and Blight uses it. Osteo Aura's problem is a tree slot, not a primitive.
- **`NEEDS channel`** — ~~Death Channel, Dark Energy Beam~~. **CLOSED.** `channel`
  ships and both nodes use it.
- **`NEEDS gravity_pull`** — ~~Singularity~~. **CLOSED.** `gravity_pull` ships and
  Singularity uses it. It remains the only shipped user of that primitive.
- **Rank-gated primitive** — Dark Matter Bomb's rank-8 splash would make the node
  `bolt` at low rank and `bolt + mortar` above it. Nothing else in the roster
  changes shape with rank. Still open, and now also blocked on the fact that
  `mortar` is not a primitive: the splash would have to be a rider on the bolt.
- **Wrecking Ball** — a dash that damages along its path. Ships as `line`, which
  resolves from the caster's position and does not carry the caster along it.
  The displacement is not expressed. Still open.
- **Stake, ruled ranged and still melee** — the one place this document
  deliberately disagrees with shipped code. See its block.
- **The `_heal` bypass** — Grasp of Death makes the Necromancer the fourteenth
  class touching it. Still open.
- **Summons tier gap** — built tier 8 is empty and tier 6 is doubled by the
  branch pair. Left as-is; tree structure is deferred roster-wide.
- **Branch pair exclusivity** — see CONFLICTS above. Casey rules.
- **`bonelord` × Marrownaut** — see RECORDED above. Unruled.
