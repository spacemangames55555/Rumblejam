# Class engines — proposed against built

Fourteen classes, one decision each. The conversion documents each propose an
engine; the code already has one. This puts them side by side so all fourteen
can be ruled together.

**No recommendations here.** Two have already been ruled and are marked.

## How to read the built side

A built engine is two separate things and both matter:

- **The scaling term.** Skills carry `scaleWith: '<term>'`, and `ENGINE_SCALE`
  gives each term a cap and a contribution — how much of a skill's output the
  term is worth at full value. This is what the class's *skills* pay attention
  to. The count in brackets is how many of the class's thirty skills use it.
- **The trait.** A separate per-class mechanic in `characters-toh.js`. Sometimes
  it *is* the engine, sometimes it is unrelated machinery that happens to sit
  nearby. Named where it is relevant, ignored where it is not.

A term marked **uncapped** has `hard: false` — no design ceiling, only a runaway
backstop.

## The shape of the answer

| verdict | classes |
|---|---|
| **Same idea** | Bard, Druid, Monk, Sundian |
| **Same idea, narrower in code** | Assassin, Witch Doctor |
| **Different ideas** | Blacksmith, Mage, Priest, Savage, Wizard |
| **Opposite signs on one idea** | Hunter, Samurai *(ruled)* |
| **No built engine** | Necromancer |

---

## Same idea

**BARD** — the closest match in the roster.
*Doc: Tempo 0–100.* Fed by casting fast: +8 if a skill fires within 2000ms of
the last, +2 otherwise. Pays out as song radius — auras project 120px at zero,
260px at full. Punishes pausing; decays 3/sec.
*Built: `rhythm` [16 skills], cap 10 hard. Trait `rhythm`: 1.5s window, 10
stacks.* Fed by casting inside a 1.5s window.
**Same idea.** Same feed, same punishment, different scale (100 points against
10 stacks) and a 0.5s difference in the window. GDD §8.3 already ruled the
Bard's engine is Rhythm.

**DRUID** — *Doc: Kinship 0–100.* Fed by presence: +1/sec per living summon,
+6 per beast skill, +1 per 10 HP healed. Pays for summons. Punishes having
nothing out — no decay at all while any animal lives, 2/sec when none does.
*Built: `pack` [12], cap 6, **uncapped**. Trait `wildshape` is a boon-fusion
system, unrelated.* Fed by live minion count.
**Same idea.** Both measure bodies standing. The doc adds healing and beast
casts as feeds; the built term is the headcount alone.

**MONK** — *Doc: Chi 0–100, starts at 50. An oscillator, not a bank.* Iron Palm
skills spend 6; Chi and Spirit skills generate 6. Also fed by healing and by
blocking. Punishes single-tree builds structurally: a pure Iron Palm Monk runs
dry, a pure Chi Monk has nothing to spend on.
*Built: `chi` [12], cap 45 hard. Trait `karma` is a separate reflect mechanic.*
**Same idea, same name.** Different scale (0–100 against a 45 cap). The
two-directional spend/generate split is the doc's addition.

**SUNDIAN** — *Doc: Tide 0–100.* Fed by drench: +1 per stack applied to an
enemy, +3 per stack consumed, +2 per kill on a drenched target. Punishes
nothing directly; decays 1/sec, the slowest in the roster.
*Built: `drench` [14], cap 14, **uncapped** — "12 per enemy, uncapped room-wide
sum". Trait `coral_growth` is separate terrain machinery.*
**Same idea, and the doc says so** — it states it invented nothing here. The
difference is a layer: the built term scales on the stacks themselves, the doc
converts stacks into a second currency that capstones then spend.

---

## Same idea, narrower in code

**ASSASSIN** — *Doc: Shadow 0–100.* Fed by two things: **+5/sec while
concealed** and +4/sec per armed trap standing, plus +8 per strike from
concealment. Punishes fighting in the open — decays 2/sec when visible with no
devices armed.
*Built: `killbox` [13], cap 6 hard, from `CONFIG.TRAP_CAP`. Trait `contract` is
a gold-payout mechanic, unrelated.* Fed by armed trap count only.
**Same idea, half of it.** The traps half matches exactly. The concealment
half — which the doc treats as the class's whole character, being paid for the
seconds before the violence — has no built counterpart.

**WITCH DOCTOR** — *Doc: Hex 0–100.* Fed by **indirect damage only**: +2 per
mirrored doll hit, +1 per DoT or hazard tick, +3 per kill he did not land
himself, +1/sec per standing proxy. Direct melee and direct projectiles
generate nothing at all.
*Built: `doll` [12], cap 10 hard. Trait `voodoo_link`: 35% mirror, 900px bind,
doll cap 10.*
**Same idea, narrower.** Both centre on the doll and its mirror. The doc widens
it to every indirect source — clouds, totems, decoys, DoTs — and adds the
prohibition on direct damage, which is the part with no built equivalent.

---

## Different ideas

**BLACKSMITH** — *Doc: Forge Heat 0–100.* Fed by being hurt: +8 taking a hit,
+6 blocking, +4 per melee cast. Pays by gating the three Crystals at 50 heat
and zeroing them on use. Punishes playing safe — decays 3/sec with no enemy
within 200px.
*Built: `form` [10], cap 1 hard — binary, in or out of a transformation. Trait
`crystal_infusion`: contact damage, grit, a detonation every third stack.*
**Different ideas that meet at the same place.** The built term pays you
*while* in a Crystal. The doc's engine pays you *to reach* one. They describe
opposite halves of the same skill and do not contradict each other.

**MAGE** — *Doc: Energy 0–100, starts full.* A depleting resource: every cast
costs by pace bucket, regenerating +3/sec plus **+2 per enemy pulled** by any
gravity skill. Punishes running eight actives. The doc *separately* invents
crystal stacks as a Crystalblade combo mechanic.
*Built: `crystal` [15], cap 10 hard, from the trait's `crystalCap`. Trait
`singularity`: a periodic pull with a vulnerability window.*
**Different ideas — and the doc contains both.** The built engine is the
crystal-stack mechanic the doc proposes as a *tree* feature; the doc's headline
engine, Energy, has no built counterpart anywhere.

**PRIEST** — *Doc: Conviction 0–100.* Fed by suffering: +1 per 10 HP healed to
anyone, +4 when an ally or summon is hit within 250px, **+15 for spending his
own HP**, +2 for taking a hit. The one engine that fills fastest when the run
is going badly for everyone else.
*Built: `marks` [12], cap 7, **uncapped** — one per marked enemy. Trait
`grace_and_judgment`: a low-HP grace threshold, shields, reflect, revive
bonuses.*
**Different ideas entirely.** The built term is offensive target-marking. The
doc's is healing and self-sacrifice. No overlap in feed, payout or punishment.

**SAVAGE** — *Doc: Momentum, 0–5 stacks.* +1 per hit landed, each stack +6%
damage, decaying one stack per 2000ms without a hit. The only engine that
cannot be banked: five seconds of not connecting and it is gone.
*Built: `cascade` [12], cap 18, **uncapped** — chain length. Trait
`blood_dance`: heat +8 per hit, max 120, decaying every 3sec, plus a bonus
scaling on missing HP.*
**Different ideas, and the class carries both.** The *trait* is the doc's
Momentum almost exactly — build on hits, drain on silence. But the *skills*
scale on `cascade`, chain length, which is a different measurement. The built
class has a momentum engine its own skills do not read.

**WIZARD** — *Doc: Mana 0–100, starts full.* The roster's only spend-down
economy: every cast costs by pace bucket, regenerating +4/sec and +6 per kill
within 300px. A skill below its cost simply waits. Punishes slotting eight
attacks — the class where the eight-slot budget is self-limiting.
*Built: `shift` [12], cap 8, **uncapped** — domain shifts per room. Trait
`decree`: a random calamity, plague or miracle every 7 seconds.*
**Different ideas entirely.** The built term rewards rotating between damage
domains, which the Wizard's three trees are built to enable (Fire/Wind,
Ice/Poison, Ethereal). The doc's is a resource pool. Nothing connects them.

---

## Opposite signs on one idea

**HUNTER** — *Doc: Bond 0–100.* Fed by **proximity**: +3 when the Hunter lands
a hit with a beast within 250px, +3 when a beast lands one with him near, +1/sec
while any beast is within 150px. Punishes distance — decays 3/sec once every
beast is beyond 250px.
*Built: `spread` [14], cap 6, hard — 90px per unit, so a 540px band. Documented
in `js/skills.js` as "more per span between you and the beast". Trait
`pack_tactics`: up to four free beasts per run, `alphaRadius` 120,
`marksmanRadius` 250.*
**Opposite signs on the same measurement.** Both read the distance between
Hunter and beast. The doc pays for it being small; the code pays for it being
large, across 14 of 30 skills. The trait carries both directions at once.

**SAMURAI** — **RULED: Footing wins, Resolve superseded.**
*Doc proposed: Resolve 0–100* — fed by being attacked, +10 per parry, +5 per
block, decaying while no stance is held.
*Built: `footing` [8] cap 10 hard, plus `armor` [7]. Trait `three_stances`.*
Fed by standing still: one stack per half-second stationary, granting a shield
pool and grit, with a 400ms movement *budget*.
**Recorded for completeness.** Resolve paid him for being attacked; Footing pays
him for not moving. See KNOWN-DEFECTS #18 for the live consequence.

---

## No built engine

**NECROMANCER** — *Doc: Essence 0–100, starts at 20.* Fed by death: +5 per
enemy dying within 400px, **+8 when one of his summons lands the kill**, +10
when one of his own summons dies, +1 per channel tick. Pays for every summon.
Decays 1/sec — a bank, not a temperature.
*Built: **none.** Two of thirty skills carry a scaling term at all — one
`armor`, one `pack`. Trait `bonelord`: four mounts, a bone-dust repair aura.*
**Nothing to compare.** The `pack` term exists and would fit a summoner, but a
single skill uses it. This is the one class where ruling for the document costs
nothing, because there is nothing on the other side.
