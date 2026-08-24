# SAMURAI — RUMBLEJAM CONVERSION (26 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.

---

## TREE RULING (settled)

**Zero of thirty skill names were shared with the built class** — the widest
divergence in the roster, and it did not resolve as one decision.

| doc tree | ruling | built counterpart |
|---|---|---|
| Blade | **→ Tactics, revise in place.** The doc is the better-specified side | Tactics (10, linear) |
| Stances | **dissolved.** Water/Stone/Fire become a trait spec; five of the other seven move into Armor as its riposte layer, one is deleted | `three_stances` trait + Armor |
| Bow | **held as a genuine gap, logged.** Needs `bolt`/`line` composes the class does not have — a `js/` patch for later | none exists |

**Names kept: Armor / Tactics / Agility.** Two reasons, neither about taste.
"Stances" is a collision the GDD already paid for once — §8.3 records it
producing a false positive in an audit against the `three_stances` trait — and
Agility is §8.1's cited shape-spec reference for the whole roster.

**The gap is real and it is the largest in the project.** The built Samurai's
thirty skills compose to `strike ×18, shield ×3, ward ×2, cone ×1`. No `bolt`,
no `line`, **no projectile of any kind**; the longest reach in the class is one
300px cone. A melee class with no ranged option at all is the hole the Bow tree
was written to fill, and it is logged beside the Necromancer's commander tree.

**Agility is not described by this document at all.** Ten built nodes —
Quickstep, Light Feet, Running Cut, Slip Cut, Gale Step, Dancing Edge, Hundred
Paces, Crescent, Windwalk, Moonfall — have no counterpart here. Armor is
likewise only 7 of 10 documented. Both are open.

---

## CLASS ENGINE — FOOTING (built, and it supersedes Resolve)

Ruled: **Footing wins, Resolve is superseded.** Footing is built, documented at
GDD §8.4, and stack-per-half-second-standing-still is the more distinctive
mechanic. Resolve's clauses were written against a stance tree that no longer
exists in this document.

```
footingTickMs         = 500     // one stack per half-second stationary
FOOTING_MAX_STACKS    = 10      // hard cap, no skill may raise it
footingShieldPerStack = 4
footingGritPerStack   = 2
footingGraceMs        = 400     // a BUDGET, not a timer
footingGraceRefill    = 1.0
```

Footing grants a shield pool and grit. **Not** Vitality — max HP has a
destructive removal path — and **not** Reflex, because a stance that makes him
harder to hit contradicts the mechanic he has surrendered dodging for.

**What this costs the document.** Resolve was a currency: skills fed it and
capstones spent it. Footing is not spendable, so every `consumes N Resolve`
line is void rather than reprice-able, and the four gates that read a Resolve
threshold now read a stack count instead. One node does not survive the swap —
Disciplined Breath was a resource valve and is held.

**The inversion worth stating plainly.** Resolve paid him for being attacked.
Footing pays him for not moving. In a game whose only input is movement, that
is a much harsher engine, and it is the built one.

---

## THE STANCE MACHINE — a trait spec, not three nodes

Water, Stone and Fire Stance are **no longer skill blocks in this document.**
The three-way exclusive stance machine is already built as the `three_stances`
trait: `p.stance` = 0/1/2 = IRON / PRECISION / FLOW, swapped by
`tohSwapStance` (`js/traits-toh.js`), read in eight places. The doc's version
was the same mechanism at a different address, and the better specification of
the two — so it is folded into the trait rather than competing with it.

| doc stance | maps to | gives | costs |
|---|---|---|---|
| Water | FLOW | +15% move speed, +20% block chance, 60% block reduction | −10% damage reduction |
| Stone | IRON | +20% damage reduction | −10% move speed |
| Fire | PRECISION | +25% damage | −15% damage reduction |

Exclusive, 2500ms swap cooldown, no duration, auto-swapping on condition —
Stone when he is being hit, Water when he is running, Fire when he is safe.
**These three occupy no slots.** That is the substantive change: the doc spent
three of eight on the machine, and the trait spends none.

### DELETED — Disciplined Breath

Ruled out of the class, not held. It restored 12 HP and 25 Resolve; Resolve is
superseded, Footing cannot be granted by a cast without contradicting its one
rule, and what remained was a 12 HP heal on a 4s cooldown. That is not worth a
tier slot. Recorded here rather than left as a stub, so the tree reads as six
deliberate nodes rather than seven with one broken.

Armor is now **6 of 10** documented. Four slots open.

**Open:** the built trait's own numbers (`ironGrit: 6`, `ironRefundPct: 0.2`,
`precisionBleedDur: 4`) are a different scheme from the table above, and
reconciling them is `js/` work outside this pass.

---

## PORT RULINGS

**1. The stance system** — see the trait spec above. Superseded as a tree.

**2. VOID — Resolve decay required a stance.** The engine is gone.

**3. Four Bow nodes have no riders and I have added them.** Hamstring Shot,
Whistling Arrow, Flaming Arrow and Pinning Shot are all 12–14 damage single
target on 6–10 second cooldowns, with nothing else. All four names promise a
rider the code does not deliver, and as shipped the Bow tree is six
interchangeable arrows. I added the named rider to each rather than raising
damage. This is four inventions in one tree and it is the largest change in
the class — every one is flagged on its block.

**4. Parry and Perfect Form become `ON_DAMAGE_TAKEN` reactives.** Both are
riposte skills built for a human reading an incoming swing. Auto-fired they
become the counter layer, which is exactly what `ON_DAMAGE_TAKEN` is for — and
under Footing they are better than they were under Resolve, because a riposte
is answered from a plant and costs no grace budget.

**5. Iaijutsu's armed state.** It arms the next strike for ×2.5 with a stun,
inside a 2100ms window (cut from 3s by roster ruling 6). Ruling: it fires
**only when at least one Tactics attack is off cooldown and an enemy is in
range of it** — otherwise the
window expires on nothing, which auto-fire would otherwise do constantly.

**6. Movement, allies, channels** carry from earlier classes.

---

## ROSTER RULING APPLIED

**Pace (ruling 1).** All 21 timed actives rebucketed, then rescaled again when
the bucket table was retuned. Three promotions to reach the distribution floor:
Falling Petal (slow → medium) for Tactics, Kiai (slow → medium) for Armor,
Running Draw (slow → medium) for Bow. Each was chosen for having no timed rider
to break, so none needed a ruling-6 cut.

**Rate: 6.00/sec on a spread build — IN BAND**, at its floor exactly. The
bucket-mix rule took this class from 5.33 by promoting Parry and Piercing Arrow
to fast, giving Armor and Bow their second fast-or-better node each. The class
still owns **no very-fast node**, so its ceiling is structural: every build is a
mix of 1.2s and 2.0s, and eight fast slots would top out at 6.67/sec. Spread and
fastest-8 are identical here for that reason.

**Mono-tree: 3.46/sec (Tactics), 3.67/sec (Bow) — both well below band.** Armor
holds only four timed actives and cannot fill eight slots. A single-tree Samurai
fires at roughly half the rate of a spread one, which is the per-tree rule's
structural limit rather than a fact about this class.

**Distribution.** Tactics 4 medium-or-faster of 7 non-capstone actives, 0 very
slow — passes. Bow 4 of 8, 0 very slow — passes. **Armor is 3 of 4 and cannot
be judged**: it holds seven of ten nodes, so the rule's "per tree of 10" has no
denominator here until the other three are authored.

**Damage share (ruling 2), under the reworded rule.** Tactics 7 damaging, Armor
5 of 7, Bow 9 — all clear the floor of 5. **The high-tier half fails in two
trees**: only Bow has one (Heaven's Arc, 55). Tactics tops out at Falling
Petal's 34, Armor at Parry's 36 with Counterstrike. Held — the fix is a retune,
and ruling 1's own "out of scope" clause forbids it. Unlike the Necromancer's
Singularity there is no mislabelled total to correct here; these nodes are
genuinely medium.

**Rider duration (ruling 6).** Seven cuts: Iaijutsu's armed window and
Duelist's Challenge's taunt-plus-damage window 4000→2100ms, Whistling Arrow's
taunt and Rain of Arrows' hazard 3000→2100ms, Flaming Arrow's burn
5000→2100ms, Hamstring Shot's slow 4000→1050ms, and **Guard Break's weaken
4000→560ms, which is a casualty** — see its block.

**Passive budget (ruling 4).** Four passives across the class — Razor's Edge,
Relentless Tempo (Tactics), Counterstrike, Immovable Mind (Armor), plus Steady
Hand in Bow makes five. Against a four-slot budget that is very nearly
non-binding, which is the opposite of the Necromancer's nine.

**Channels (ruling 5).** Not applicable — the class has none.

**Engine cost (ruling 3).** Not applicable. Footing is not spendable.

### HELD

**RESOLVED — Disciplined Breath is deleted.** See the section above.

**RESOLVED — Guard Break's weaken.** It was a ruling-6 casualty at 560ms under
the first bucket table. The rescale to a 1.2s fast bucket puts it at 840ms,
clear of the 500ms floor that this node's failure produced.

**1. No high-tier node in Tactics or Armor.** Logged against the power-curve
pass, which owns damage values. Ruling 1 forbids retuning them here, and unlike
the Necromancer's Singularity there is no mislabelled total to correct — these
nodes are genuinely medium.

**2. Agility is undocumented and Armor is 6 of 10.** Fourteen built nodes have
no counterpart in this file.


---

## TREE: BLADE

Role read: **the melee DPS.** The highest and most consistent damage in the
class, all of it inside 100px. This is the tree where the Samurai is a
duelist in a game that does not offer duels — everything here is built to
kill one thing well, and the swarm does not cooperate.

---

SKILL NAME:           First Cut
CLASS / TREE / TIER:  samurai / Tactics / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (70px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 target every 5th rank
--- identity ---
ENGINE:               Footing-neutral. A strike does not build Footing —
                      standing still does — but at 800ms First Cut is the
                      skill that makes standing still pay, since it is the
                      fastest thing he can do without taking a step
COST:                 seventy pixels and no rider. It is the plainest skill
                      in the class and it will be in every Blade build for
                      the whole run, because at 800ms it is the fastest thing
                      he can do without spending a step of grace
VISUAL:               a single clean draw-and-return, the blade already sheathed
                      before the enemy registers the line
FLAVOR:               The first cut is not the important one. The first cut
                      is a question. He has simply gotten very quick at asking.

SKILL NAME:           Twin Fangs
CLASS / TREE / TIER:  samurai / Tactics / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (13 × 2 pulses = 26)
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
RANK ADDS:            +3 damage per pulse; +1 pulse every 7th rank
--- identity ---
ENGINE:               Footing-neutral, and both pulses land from a standing
                      position, so it spends none of the grace budget
COST:                 twenty-six over 3200ms against First Cut's twenty over
                      2000ms — it is slower damage per second at rank 1 and
                      only overtakes once ranks accumulate. It is also two
                      chances to proc Razor's Edge bleeds instead of one,
                      which is the actual reason to take it
VISUAL:               two strikes crossing at the wrist, the second arriving
                      from the opposite side before the first has finished
FLAVOR:               A snake does not bite twice because the first was
                      insufficient. It bites twice because it has two.

SKILL NAME:           Razor's Edge
CLASS / TREE / TIER:  samurai / Tactics / tier_code 2
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
RIDERS:               scene-keyed [declared, not derived] — "your edge is
                      honed past mercy: every strike leaves a wound that
                      keeps BLEEDING"
DOT:                  bleed applied by every Blade strike — magnitude in
                      MainScene
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2 bleed damage per tick per rank; +1s bleed duration
                      every 5th rank
--- identity ---
ENGINE:               Footing-neutral directly, but it multiplies every
                      strike he lands while planted, which is where the class
                      spends most of its time
COST:                 it does nothing for the Bow tree and nothing for the
                      Stances tree's Kiai or Guard Break. It is a Blade-only
                      multiplier occupying a general slot, and a hybrid
                      Samurai gets a fraction of its value
VISUAL:               struck enemies keep a thin dark line where the blade
                      passed, and the line keeps opening
FLAVOR:               There is a stage past sharp that has no name in most
                      languages and a very specific one in his. It is not
                      about the cutting. It is about what the wound is unable
                      to do afterward.

SKILL NAME:           Iaijutsu
CLASS / TREE / TIER:  samurai / Tactics / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (arms the next striking hit, 3000ms window)
RANGE:                n/a
TARGETS:              self; the armed strike deals ×2.5 and stuns
--- output ---
DAMAGE TIER:          none (0) at cast
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               the armed strike gains ×2.5 damage and stun 700ms on
                      its targets. Armed window 3000ms as authored — the
                      rescaled slow bucket's 4s clears it, so ruling 6 makes no
                      cut here. Fires only
                      when a Tactics attack is off cooldown with an enemy in
                      its range (ruling 5)
DOT:                  none
AFFECTS:              self + enemies (deferred)
--- automation ---
TRIGGER:              COOLDOWN_READY, gated per ruling 5
THREAT:               some (delivered by the armed strike)
--- growth ---
RANK ADDS:            +0.15× to the multiplier per rank; +100ms stun every
                      4th rank
--- identity ---
ENGINE:               Footing-neutral — no cost. The old Resolve price is
                      gone with the engine; nothing replaces it, because
                      Footing is not a currency that can be spent
COST:                 it does nothing by itself. Twelve seconds of cooldown
                      spent on making one other skill better, and if the window closes unspent it was a pure
                      loss. It is the only skill in the class that can be
                      wasted by the automation making a reasonable decision
VISUAL:               the hand settles on the saya and stays there; the whole
                      character goes still in a way the animation set does not
                      otherwise permit
FLAVOR:               The art is not in the cut. The cut takes a fifth of a
                      second and any fool can be taught it. The art is the
                      part where he does nothing at all, correctly, for as
                      long as it takes.

SKILL NAME:           Crescent Sweep
CLASS / TREE / TIER:  samurai / Tactics / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (140° total)
RANGE:                melee long (100px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 100px — the fan orients to the
                      cluster centroid
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +6° cone width every 4th rank
--- identity ---
ENGINE:               Footing-neutral, and it fires from a plant
COST:                 a hundred and forty degrees is the widest arc in the
                      class and it still leaves half the circle open. The
                      Samurai has no self-centred area skill anywhere in the
                      Blade tree, so being surrounded is a problem he simply
                      does not have an answer to here
VISUAL:               a single unbroken arc at chest height, the trail of it
                      hanging in the air a beat longer than it should
FLAVOR:               A wide cut is an admission that there is more than one
                      of them. He does not enjoy making it.

SKILL NAME:           Dragonfly Cut
CLASS / TREE / TIER:  samurai / Tactics / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range short (190px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               NO knockdown — `knockdownMs 0`, deliberately zeroed in
                      code. Caster displaced 190px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (80px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +15px dash distance every 4th rank
--- identity ---
ENGINE:               Footing-HOSTILE — it displaces him 190px, which spends
                      the whole 400ms grace budget and drops every stack
COST:                 the zeroed knockdown is not an oversight to fix — it is
                      what distinguishes this from every other dash in the
                      game. He passes through and leaves them standing, which
                      means the enemies he just cut are still upright and
                      still coming, and he is now 190px away with his back to
                      wherever he landed
VISUAL:               a single pass, very low, the blade held out and level;
                      he does not look at what he cuts
FLAVOR:               A dragonfly does not turn. It goes, and then it is
                      somewhere else, and the interval between those two
                      facts is not available for inspection.

SKILL NAME:           Relentless Tempo
CLASS / TREE / TIER:  samurai / Tactics / tier_code 6
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
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: attackSpeedMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4% attack speed per rank — applies to every skill the
                      character owns, including Bow
--- identity ---
ENGINE:               Footing-neutral. Attack speed does not build stacks,
                      but it raises what a held stance is worth per second
COST:                 attack speed is worth the most in a build with many
                      short-cooldown skills and almost nothing in a build
                      built around Heaven's Arc and Perfect Form. It quietly
                      requires you to have already decided to be a Blade
                      Samurai
VISUAL:               no discrete effect; the return to guard between strikes
                      gets shorter and eventually stops being visible
FLAVOR:               Speed was never the goal. Speed is what is left over
                      once you stop doing the things that were not necessary.

SKILL NAME:           Duelist's Challenge
CLASS / TREE / TIER:  samurai / Tactics / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1 marked
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               taunt 2800ms on the marked enemy, PLUS a 2800ms window
                      in which ALL of the player's damage is ×1.25 — global,
                      not mark-only (see note). Both cut from an authored
                      4000ms by roster ruling 6 (70% of the 4s cooldown)
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              THREAT_ON_ALLY — fires at whatever is attacking someone
                      who is not the Samurai. Solo, falls back to
                      CROWD_THRESHOLD (4+ within 300px) for the damage window
THREAT:               high — this is the class's only taunt and its only real
                      tank contribution
--- growth ---
RANK ADDS:            +500ms taunt per rank; +2% to the global multiplier
                      every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 fourteen seconds for four. In co-op it is a genuine
                      peel and a party-wide damage window at the same time,
                      which is a lot for one slot. Solo the taunt half is
                      nearly worthless — pulling one enemy toward a melee
                      character who wanted it there anyway
VISUAL:               he points the blade at one specific enemy and holds it;
                      that enemy turns, and the air around him briefly sharpens
FLAVOR:               A challenge is a contract. He has never once issued one
                      to something that could read, and it has never once
                      failed to be understood.

> **Global multiplier flagged:** the export notes the ×1.25 runs through the
> global darkVuln channel rather than applying to the mark. It amplifies
> *everything the player does* for four seconds, not just hits on the marked
> enemy. Like Execute's ring-wide behavior, I kept it — a taunt that is also
> a party damage cooldown is more interesting than a taunt. But it is
> almost certainly not what the skill's name intends, so it is your call.

SKILL NAME:           Falling Petal
CLASS / TREE / TIER:  samurai / Tactics / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (telegraph ring r110 at 60px, 600ms delay)
RANGE:                range short (170px)
TARGETS:              uncapped in ring (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (34) — 75 against stunned or slowed targets
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               ×2.2 per target that is currently STUNNED or SLOWED,
                      resolved per-target, correctly
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 170px, preferring clusters where
                      2+ enemies are stunned or slowed
THREAT:               some
--- growth ---
RANK ADDS:            +6 base damage (the ×2.2 does not scale, so a rank-10
                      Petal hits controlled targets for 207)
--- identity ---
ENGINE:               Footing-neutral, and it is placed rather than
                      travelled, so it costs no grace
COST:                 a 600ms telegraph on a swarm that moves. The ring is
                      drawn where they are and lands where they were, and its
                      doubling needs a control skill in another slot — Kiai
                      or Guard Break, both in a different tree
VISUAL:               a ring drawn on the floor in pale pink, held for a
                      breath, and then everything inside it comes apart at
                      once with no visible strike
FLAVOR:               It falls when it falls. Not when the wind takes it,
                      not when the branch decides. There is a moment at which
                      the arrangement stops being tenable and the moment is
                      not negotiable and everyone can see it coming.

SKILL NAME:           Thousand Cuts
CLASS / TREE / TIER:  samurai / Tactics / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain (auto-cascading strikes)
RANGE:                range short (200px per link)
TARGETS:              cascades from target to target for the duration
--- output ---
DAMAGE TIER:          low (12 per strike)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               auto-casts a chain of strikes over 6000ms, each finding
                      the nearest enemy to the last; every strike procs
                      Razor's Edge if owned
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px), gated on 6+ Footing
                      stacks — it wants to fire from a set stance
THREAT:               high
--- growth ---
RANK ADDS:            +2 damage per strike; +500ms cascade duration every
                      4th rank
--- identity ---
ENGINE:               Footing-neutral, and he ends the cascade standing
                      where he started, which is the rare capstone that does
                      not cost him his stance
COST:                 twenty-five seconds for twelve damage a strike. Its
                      entire case rests on Razor's Edge — with bleeds it is
                      the biggest thing in the class, and without them it is a
                      light show. Two slots, one of them a passive, before the
                      capstone works
VISUAL:               he stops being in one place. The strikes are visible as
                      afterimages resolving in sequence and he is standing
                      still again before the last one lands
FLAVOR:               The count is not literal and he has never claimed it
                      was. It is a description of a state in which the
                      question of how many has stopped being one he is
                      tracking.

---

## TREE: STANCES

Role read: **the tank spec, and the class's brain.** Three exclusive forms
that auto-swap on condition, a taunt, two riposte skills, and stun immunity.
A Samurai running all three stances is spending three slots on a machine
that reads the room — and that machine is the single most legible piece of
automation in the roster.

---

SKILL NAME:           Guard Break
CLASS / TREE / TIER:  samurai / Armor / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 6)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r74)
RANGE:                melee short (74px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               weaken 30% for 840ms, cut from an authored 4000ms by
                      roster ruling 6 (70% of the 1.2s cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy not already weakened,
                      so the debuff spreads rather than refreshing
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +2% weaken every 2nd rank; +400ms weaken
                      duration every 4th rank
--- identity ---
ENGINE:               Footing-neutral, and it is delivered from a plant.
                      Under Resolve this node generated nothing because it was
                      not a Blade strike; Footing does not make that
                      distinction, so the old dead spot is gone
COST:                 a 30% weaken on four enemies is the best defensive
                      value in the class and it is invisible. Nothing on screen
                      tells the player it is working, and a new player will drop
                      it for something with a bigger number. Under the first
                      bucket table this node was a ruling-6 casualty at 560ms —
                      nine frames of weaken, which reads as a broken skill. The
                      rescale to a 1.2s fast bucket puts it at 840ms, clear of
                      the 500ms floor the casualty produced
VISUAL:               a short hard strike at the guard hand; the enemy's next
                      swing visibly lacks commitment
FLAVOR:               He is not trying to hurt them. He is trying to make
                      the next thing they do cost them slightly more than
                      they budgeted.

SKILL NAME:           Parry
CLASS / TREE / TIER:  samurai / Armor / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 6)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at the attacker)
RANGE:                melee short (at the attacker)
TARGETS:              cap 2
--- output ---
DAMAGE TIER:          medium (22 riposte, 36 with Counterstrike owned)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               riposte — resolves as an immediate counter-strike on
                      whatever attacked him
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN
THREAT:               some
--- growth ---
RANK ADDS:            +4 riposte damage per rank; −300ms cooldown every 4th
                      rank, floor 3000ms
--- identity ---
ENGINE:               Footing-positive by position — a parry is answered
                      without moving, so every riposte is a hit taken and
                      returned with the stance intact
COST:                 it requires being hit, which is the failure state of
                      the game. Every point in Parry is a bet against the
                      player's own movement, and a Samurai played well gets
                      very little out of the class's best Resolve source
VISUAL:               the incoming strike is turned aside on the flat and the
                      answer comes back along the same line without a pause
FLAVOR:               He does not block. Blocking is agreeing to be hit
                      somewhere convenient. This is closer to declining to
                      accept delivery.

SKILL NAME:           Counterstrike
CLASS / TREE / TIER:  samurai / Armor / tier_code 2
TYPE:                 passive
AXIS POSITION:        3 (of 6)
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
RIDERS:               scene-keyed [declared, not derived] — "the answer
                      sharpens: ripostes hit 14 harder and every successful
                      parry returns 10 Resolve"
DOT:                  none
AFFECTS:              self, enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4 riposte damage per rank. The +2-Resolve-per-parry
                      half is void with the engine
--- identity ---
ENGINE:               Footing-neutral. Its declared text — "every successful
                      parry returns 10 Resolve" — is the line the superseded
                      Resolve engine was derived from. Footing is the built
                      engine and it wins; this text is now the last live
                      reference to a resource that does not exist
COST:                 it modifies exactly two skills, Parry and Perfect Form,
                      both in this tree. Without Parry slotted it is a dead
                      node, and with it the pair costs two of eight slots
                      before either does anything on its own
VISUAL:               the riposte gains a second beat — a short follow-up
                      that was not there before
FLAVOR:               The counter is not a reaction. A reaction is late by
                      definition. What he is doing is arriving on time at a
                      place he decided on some while ago.

SKILL NAME:           Immovable Mind
CLASS / TREE / TIER:  samurai / Armor / tier_code 3
TYPE:                 passive
AXIS POSITION:        4 (of 6)
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
RIDERS:               scene-keyed [declared, not derived] — "the mind cannot
                      be staggered: immune to stun, knockback and knockdown"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            the immunity is binary and does not scale. Ranks
                      instead grant +2% damage reduction each — otherwise
                      this node is unrankable and a point sink with no floor
--- identity ---
ENGINE:               neutral
COST:                 entirely delivered at rank 1, and worth nothing at all
                      in rooms whose enemies do not stun. It is the Blacksmith's
                      Iron Will with less on it, and the same problem: a
                      binary passive in a game with unlimited ranks is a node
                      you take once and never think about again
VISUAL:               incoming stun effects visibly fail to land — a small
                      break at the point of contact and he does not pause
FLAVOR:               They have stopped trying to stagger him. Not out of
                      respect. It is simply that the attempt has become
                      embarrassing to make.

SKILL NAME:           Kiai
CLASS / TREE / TIER:  samurai / Armor / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 6)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (90° total)
RANGE:                melee long (110px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (10)
PACE:                 medium (2000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               stun 900ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (110px)
THREAT:               some
--- growth ---
RANK ADDS:            +100ms stun and +4° cone width per rank (not damage —
                      ten damage is not the point and inflating it would make
                      this a bad attack instead of a good control skill)
--- identity ---
ENGINE:               neutral
COST:                 ten damage. It exists to set up Falling Petal's ×2.2
                      and to buy a second of floor, and those two jobs are in
                      two different trees. A Samurai who takes Kiai without
                      Petal has bought a very expensive shout
VISUAL:               no strike at all — a shout, rendered as a visible
                      pressure front, and everything in the wedge locks up
FLAVOR:               It is not loud. That is what surprises people. It is
                      pitched at something else entirely and the body hears
                      it before the ear does.

SKILL NAME:           Perfect Form
CLASS / TREE / TIER:  samurai / Armor / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 6)
--- delivery ---
CAST:                 self
SHAPE:                none (auto-ripostes every hit for the duration)
RANGE:                n/a — ripostes resolve at each attacker
TARGETS:              every attacker, for the window
--- output ---
DAMAGE TIER:          medium (26 per riposte, +14 with Counterstrike)
PACE:                 capstone (25000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               for 6000ms every incoming hit is parried and answered
                      with a 26-damage riposte. 6000ms sits under the 25s
                      capstone cooldown, so ruling 6 leaves it alone
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 150px), gated on 6+ Footing
                      stacks
THREAT:               high
--- growth ---
RANK ADDS:            +5 riposte damage per rank; +500ms duration every 4th
                      rank
--- identity ---
ENGINE:               Footing-positive, and strongly — the window is six
                      seconds of standing still parrying everything, which is
                      the single longest uninterrupted stack climb the class
                      can buy
COST:                 twenty-five seconds, and it only pays out if he is
                      being hit constantly. It is a capstone that
                      requires the player to walk into the worst position on
                      the board and stay there, and the trigger I set will
                      fire it there deliberately
VISUAL:               he stops moving. Everything that comes at him is turned
                      and answered in the same motion, and the animation does
                      not vary — it is the same parry, correct every time
FLAVOR:               There is a version of this where he is not thinking at
                      all and it is the version that works. He spent forty
                      years arriving at six seconds of it and considers the
                      exchange fair.

---

## TREE: BOW

Role read: **the ranged spec, and the weakest tree in the class as shipped.**
Six single-target arrows with no riders, a hazard, a dash, and a 55-damage
capstone. It is the safest way to play a Samurai and the least interesting,
and four of its nodes needed riders written for it to function as a tree.

---

SKILL NAME:           Yumi Shot
CLASS / TREE / TIER:  samurai / Bow / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (16)
PACE:                 fast (1200ms)
DOMAIN:               physical
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
ENGINE:               Footing-POSITIVE, and this is the ruling's biggest
                      single reversal. Under Resolve a pure Bow Samurai fed
                      nothing and that was the tree's structural problem. Under
                      Footing an archer who stands still is the best stack
                      holder in the class, and the tree's problem inverts into
                      its argument
COST:                 sixteen damage every 800ms is the tree's entire floor.
                      Under Resolve a Bow build could not afford Iaijutsu,
                      Perfect Form, Thousand Cuts or its own capstone; under
                      Footing all four are reachable, because standing at range
                      is exactly how Footing is earned. Bow is now the safe
                      tree and the well-fed one
VISUAL:               a long asymmetric draw and a flat release; the arrow is
                      gone before the bow has finished moving
FLAVOR:               The bow is longer than he is tall and the grip is a
                      third of the way up it, and there is a reason for that
                      which takes about nine years to feel rather than know.

SKILL NAME:           Piercing Arrow
CLASS / TREE / TIER:  samurai / Bow / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                line
RANGE:                range long (400px)
TARGETS:              pierces all enemies along the line (port change — see
                      COST)
--- output ---
DAMAGE TIER:          low (14)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 400px — aims along the axis that
                      lines up the most bodies
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; the pierce is unlimited from rank 1
--- identity ---
ENGINE:               neutral
COST:                 it needs enemies in a line, and nothing in the Samurai's
                      kit arranges them into one. Against a scattered swarm it
                      is Yumi Shot on a worse cooldown
VISUAL:               a single heavy shaft that does not slow when it passes
                      through something
FLAVOR:               Armour is a bet about angles. He has spent a long time
                      studying the angles at which the bet is not being made.

> **Port change flagged:** ToH's Piercing Arrow is single-target and pierces
> nothing, which makes the name meaningless and the node strictly worse than
> the tier below it. I made it pierce. Flagged.

SKILL NAME:           Hamstring Shot
CLASS / TREE / TIER:  samurai / Bow / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — slow ×0.45 for 1400ms, cut from an authored
                      4000ms by roster ruling 6 (70% of the 2s cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy not already slowed
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +400ms slow duration every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 twelve damage. The slow is the whole skill, and it is
                      single target in a game whose problem is plural
VISUAL:               a low shot at the back of the leg; the target's gait
                      breaks and does not recover
FLAVOR:               Unsporting. He is aware. He was taught the sporting
                      version first and then taught what it was for, and the
                      second lesson made the first one look like a hobby.

> **AUTHORED:** no rider in ToH. Name promises a slow; I wrote one.

SKILL NAME:           Steady Hand
CLASS / TREE / TIER:  samurai / Bow / tier_code 3
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
RIDERS:               stat mods: damageMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4% damage multiplier per rank — global, applies to
                      Blade and Stances too
--- identity ---
ENGINE:               neutral
COST:                 it is the best node in the Bow tree and it has nothing
                      to do with bows. A Blade Samurai should reach across
                      and take it, and the tree's own arrows benefit from it
                      least because their base numbers are the lowest in the
                      class
VISUAL:               nothing visible; the draw stops having any tremor in it
FLAVOR:               Steadiness is not stillness. A still hand is a hand
                      that has stopped participating. What he has is a hand
                      that is doing a great deal and none of it visible.

SKILL NAME:           Whistling Arrow
CLASS / TREE / TIER:  samurai / Bow / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               AUTHORED — on impact, taunts every enemy within 150px
                      of the target for 3000ms as authored — the rescaled
                      slow bucket's 4s clears it — pulling them toward the
                      arrow rather than the Samurai
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              THREAT_ON_ALLY — fired into a group attacking someone
                      else. Solo, fires at the densest cluster to gather them
                      away from him
THREAT:               high — but the threat lands on a point in space, not on
                      the caster, which makes it the only remote taunt in the
                      roster
--- growth ---
RANK ADDS:            +2 damage; +500ms taunt and +10px gather radius every
                      3rd rank
--- identity ---
ENGINE:               neutral
COST:                 it moves the problem rather than solving it, and it
                      moves the problem to a place he chose, which is either
                      excellent or a nine-second cooldown spent rearranging a
                      swarm that was fine where it was
VISUAL:               the shaft screams in flight — a rising note — and every
                      head in the area turns toward where it lands
FLAVOR:               The signal arrow opened battles for six hundred years.
                      It was never meant to hit anyone. It was meant to
                      settle the question of where everyone was going to be.

> **AUTHORED:** no rider in ToH. A whistling arrow is a signalling device;
> I built the rider from that rather than from a damage number. This is the
> most inventive of the four and the one most worth your judgment.

SKILL NAME:           Running Draw
CLASS / TREE / TIER:  samurai / Bow / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range short (220px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (14)
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               the caster dashes as part of the cast; the dash itself
                      deals no damage. Displacement resolved away from the
                      densest cluster per the movement ruling
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (100px) — this is an escape that
                      happens to shoot something
THREAT:               none
--- growth ---
RANK ADDS:            +3 damage; +15px dash distance every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 fourteen damage, and the dash is the point. It is the
                      only mobility in the Bow tree and its damage is a
                      rounding error, so it competes for a slot against
                      things that kill
VISUAL:               he is moving before the string releases; the shot goes
                      backward over his own shoulder without a look
FLAVOR:               Shooting from a horse is not a different skill from
                      shooting standing. It is the same skill, performed by
                      someone who has stopped believing the ground is
                      relevant.

SKILL NAME:           Flaming Arrow
CLASS / TREE / TIER:  samurai / Bow / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (14)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — burn DoT, 6 per 1000ms for 2800ms (cut from
                      an authored 5000ms by roster ruling 6); the burn spreads
                      once to an enemy within 60px on the target's death
DOT:                  6 per 1000ms for 5000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy not already burning
THREAT:               none
--- growth ---
RANK ADDS:            +2 impact damage; +1 burn per tick every 2nd rank; +1
                      additional spread on death every 5th rank
--- identity ---
ENGINE:               neutral
COST:                 forty-four total damage over five seconds on an
                      eight-second cooldown, all of it into one enemy. The
                      spread-on-death is what makes it a swarm skill, and it
                      only triggers if the burn is what finished them
VISUAL:               the arrowhead is wrapped and lit; where it sticks, the
                      fire keeps working, and it jumps at the moment the
                      target drops
FLAVOR:               Fire arrows were for buildings and rope and sails. He
                      has never entirely adjusted to using one on a person
                      and has decided that the failure to adjust is the
                      correct response.

> **AUTHORED:** no rider in ToH — 14 damage, single target, 8s cooldown.
> Name promises a burn; I added it and a spread-on-death to give the Bow
> tree one skill that scales with crowds.

SKILL NAME:           Rain of Arrows
CLASS / TREE / TIER:  samurai / Bow / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r130, persistent hazard 3000ms — as
                      authored; the rescaled slow bucket's 4s clears it)
RANGE:                range short (240px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 8 per 350ms tick
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  ground tick 8 per 350ms for 3000ms — about 68 to
                      anything that stays in it
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 240px
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 three seconds is the shortest hazard in the game.
                      Enemies walking through it catch two or three ticks,
                      not the full sixty-eight, and nothing in the Samurai's
                      kit holds them in place
VISUAL:               a brief dense fall inside a hard circle, arrows
                      standing in the ground afterward and fading
FLAVOR:               One archer cannot do this. He is aware that everyone
                      watching knows one archer cannot do this, and he has
                      chosen not to address it.

SKILL NAME:           Pinning Shot
CLASS / TREE / TIER:  samurai / Bow / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — root 2500ms; the rooted target also takes
                      +20% damage from all sources for the duration
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (150px) — pins the thing that got
                      closest
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +300ms root every 3rd rank; +2%
                      vulnerability every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 one enemy, two and a half seconds, ten-second cooldown.
                      It is a good answer to a single dangerous thing and no
                      answer at all to twenty ordinary ones, and tier 9 of a
                      tree is a poor place to still be solving single-target
                      problems
VISUAL:               the shaft goes through the foot and into the floor and
                      stays there; the enemy pulls against it visibly
FLAVOR:               Pinning is not killing. He would like that understood.
                      Killing is a separate decision made afterward and
                      usually by someone else.

> **AUTHORED:** no rider in ToH. Name promises a root; I added it plus the
> vulnerability, so the Bow tree has one setup skill for Heaven's Arc.

SKILL NAME:           Heaven's Arc
CLASS / TREE / TIER:  samurai / Bow / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (460px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          high (55)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 460px, gated on 4+ Footing
                      stacks
THREAT:               some
--- growth ---
RANK ADDS:            +10 damage; at rank 6 the impact splashes r80, +12px
                      splash every 4 ranks thereafter
--- identity ---
ENGINE:               Footing-neutral. Under Resolve this capstone was gated
                      behind a resource the Bow tree could not produce, which
                      was the honest structural verdict on Bow. Footing
                      removes that gate — a stationary archer holds stacks
                      better than anyone in the class
COST:                 forty-five seconds for fifty-five damage into one
                      enemy. Every other tier-10 in the roster affects a
                      crowd; this one affects a target. Until the rank-6
                      splash it is a very slow rifle
VISUAL:               the shot goes up and out of frame entirely and there is
                      a pause with nothing in it, and then it arrives
                      vertically
FLAVOR:               He is not aiming at them. He is aiming at a place, and
                      at a time, and the arrow is simply the instrument by
                      which the two are made to coincide.
