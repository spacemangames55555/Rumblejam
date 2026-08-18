# Phase 2 measurement: are the two curves commensurate?

Measured, not tuned. Reproduce with `node tools/power_curve_phase2.mjs`
(`--quick` for a 5-class sample, `--only=N,N` for one section).

Every number here rests on the precondition commit — items, MOVEMENT staging,
bounded targets, slot-pinned fixtures. An un-itemised reading is low by 13–46%
*depending on the class*, which is exactly the error a band-by-band ratio cannot
absorb.

---

## The headline

**T1 is almost already satisfied. T2's premise is wrong. The real defect is
neither.**

Player growth and enemy growth track each other in **six of seven bands**. Of
the two that don't, one is region 1→2 and the other is measurement noise. That
was the thing phase 2 was convened to find, and it is very nearly not there.

What *is* there, and what phase 1 could not see: **the endgame is bimodal, not
soft.** Ten of fourteen level-82 itemised builds *die* in a region-8 room, most
inside 30 seconds. The four that live are the sustain classes, and they are
never in danger at all. "The endgame doesn't threaten" was an artifact of
measuring the two classes that cannot be killed.

---

## 1. Composed enemy threat — plain `combat` node, every region

Node kind held constant per §13 rule 85. Templates and profiles still differ;
they are named so nobody reads a template difference as a curve finding.

| rgn | template | profile | mean HP | incoming HP/s | peak alive | spawned | axis |
|---|---|---|---|---|---|---|---|
| 1 | open_expanse | flanker | 8.6 | 0.3 | 5 | 19 | ×1.00 |
| 2 | cramped_crypt | mixed | 26.8 | 7.0 | 27 | 64 | ×2.13 |
| 3 | cramped_crypt | mixed | 53.7 | 22.6 | 52 | 118 | ×3.84 |
| 4 | long_hall | artillery | 52.3 | 17.5 | 71 | 131 | ×4.33 |
| 5 | open_expanse | bastion | 60.8 | 10.2 | 35 | 78 | ×5.29 |
| 6 | pillared_field | bastion | 69.3 | 19.9 | 34 | 87 | ×6.02 |
| 7 | cramped_crypt | swarm | 74.7 | 28.3 | 145 | 216 | ×7.35 |
| 8 | broken_ground | flanker | 85.0 | 30.0 | 101 | 205 | ×7.36 |

Per-body HP goes ×9.9 across the run against a ×7.36 axis; incoming goes ×100.

## 2. Player output — itemised, at each region's §4.3 anchor level

Median of all 14 classes, 20 s window, fixed 900 HP mortal ring, best of the
MOVEMENT windows the kit asks for. Items scale with regions reached.

| rgn | level | slots | shallow DPS | deep DPS | deep/shallow | median vitality |
|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 19.4 | 19.4 | 1.00 | 93 |
| 2 | 10 | 3 | 114.3 | 38.8 | 0.34 | 99 |
| 3 | 19 | 6 | 195.8 | 107.6 | 0.55 | 115 |
| 4 | 28 | 6 | 258.0 | 150.2 | 0.58 | 111 |
| 5 | 37 | 8 | 290.1 | 198.5 | 0.68 | 117 |
| 6 | 46 | 8 | 298.8 | 200.4 | 0.67 | 167 |
| 7 | 55 | 8 | 366.2 | 241.3 | 0.66 | 138 |
| 8 | 64 | 8 | 376.6 | 273.9 | 0.73 | 166 |

The deep build trails throughout and closes steadily (0.34 → 0.73). That is
rule 86's capstone variance, accepted, not re-flagged.

## 3. The ratio, band by band

Two ratios, because "commensurate" is two questions.

| rgn | offence (shallow) | offence (deep) | defence | band | player × | enemy HP × | incoming × | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | 2.3 | 2.3 | 348.8 | | | | | |
| 2 | 4.3 | 1.4 | 14.2 | 1→2 | ×5.89 | ×3.13 | ×26.13 | **PLAYER OUTPACES** |
| 3 | 3.6 | 2.0 | 5.1 | 2→3 | ×1.71 | ×2.00 | ×3.24 | tracks |
| 4 | 4.9 | 2.9 | 6.4 | 3→4 | ×1.32 | ×0.98 | ×0.77 | *(noise — §6)* |
| 5 | 4.8 | 3.3 | 11.5 | 4→5 | ×1.12 | ×1.16 | ×0.58 | tracks |
| 6 | 4.3 | 2.9 | 8.4 | 5→6 | ×1.03 | ×1.14 | ×1.95 | tracks |
| 7 | 4.9 | 3.2 | 4.9 | 6→7 | ×1.23 | ×1.08 | ×1.42 | tracks |
| 8 | 4.4 | 3.2 | 5.5 | 7→8 | ×1.03 | ×1.14 | ×1.06 | tracks |

*offence = player DPS / mean enemy HP = bodies deleted per second.
defence = player vitality / incoming = seconds to die standing still.*

**The offence column is flat from region 2 onward: 4.3, 3.6, 4.9, 4.8, 4.3, 4.9,
4.4 — a ±16% band across six regions and a ×7.36 world axis.** The two curves are
commensurate almost everywhere.

### The tuning target, per T1

**Region 1→2, and nothing else.** The player gains ×5.89 while the bodies gain
×3.13. The cause is legible in the table: a region-1 character is level 1 with
**one** loadout slot, and by region 2 it has three. The step is the slot ladder,
not the damage numbers — offence goes 2.3 → 4.3 because two more skills started
firing, and no per-body tuning addresses that.

Region 1's defence figure (348.8 seconds to die against 0.3 incoming HP/s) says
the same thing from the other side: **region 1 is not a fight.** If band 1→2 is
to be closed, region 1 is the end to move.

Band 3→4 is flagged by the arithmetic and withdrawn by §6 below.

## 4. The regions 4–5 incoming dip — diagnosed

Phase 1 measured incoming 22.6 / 17.5 / 10.2 across regions 3/4/5 and called it
worth a look. Re-measured, same region, five seeds:

| rgn | incoming HP/s per seed | mean | spread |
|---|---|---|---|
| 3 | 22.6 18.3 18.2 19.6 15.0 | 18.7 | ×1.5 |
| 4 | 17.5 20.7 19.6 15.0 25.4 | 19.6 | ×1.7 |
| 5 | 10.2 12.8 27.3 19.9 20.4 | 18.1 | ×2.7 |
| 6 | 19.9 27.8 12.9 24.4 22.5 | 21.5 | ×2.2 |

**Worst within-region spread ×3.5. Spread across the regions' means: ×1.3.**

The dip is the generator picking a lighter room, not a hole in the curve. Phase
1's 10.2 was one seed at the bottom of a range that runs to 27.3 in the same
region. **Do not tune regions 4–5 on this evidence** — it would be tuning a coin
flip.

## 5. Clear time and threat — a real region-8 room

Itemised level-82 build, no god mode, healing and death live, driven by
`driveEngage` (advance on nearest, hold at 110). That driver is a **floor** on
real play: it never kites or retreats. Left stationary instead, the same hunter
dies at 17.8 s — those are statue numbers and are not used here.

| class | spend | outcome | secs | kills | spawns end | min HP% |
|---|---|---|---|---|---|---|
| hunter | shallow | **DIED** | 19.6 | 15 | — | 0.0 |
| hunter | deep | **DIED** | 22.8 | 40 | — | 0.0 |
| wizard | shallow | **DIED** | 21.5 | 23 | — | 0.0 |
| wizard | deep | **DIED** | 19.7 | 38 | — | 0.0 |
| monk | shallow | **DIED** | 29.5 | 66 | — | 0.0 |
| monk | deep | **DIED** | 32.5 | 78 | — | 0.0 |
| priest | shallow | cleared | 150.1 | 635 | 100.6 s | 66.3 |
| priest | deep | timeout | 300.0 | 780 | 100.6 s | 79.1 |
| blacksmith | shallow | **DIED** | 27.8 | 56 | — | 0.0 |
| blacksmith | deep | **DIED** | 28.9 | 52 | — | 0.0 |
| savage | shallow | cleared | 123.7 | 599 | 100.6 s | 90.3 |
| savage | deep | cleared | 200.3 | 658 | 100.6 s | 66.3 |
| druid | shallow | **DIED** | 25.9 | 45 | — | 0.0 |
| druid | deep | **DIED** | 26.8 | 60 | — | 0.0 |

**10 of 14 runs died.** A region-8 room fields ~635–780 bodies and stops spawning
at 100.6 s; clearing it takes ~150 s for a build that survives.

Read the DIED column before the min-HP one. A build that dies never records a
low-health moment, so "never dropped below 50%" and "died at 20 s" are the same
row for different classes and must never be averaged together — which is how
phase 1's "the endgame doesn't threaten" was produced.

### What T2 actually asks for

T2 says the endgame should threaten. It does — far more than intended for ten
classes, and not at all for four. **The defect is the gap, not the level.**

## 6. Is band 3→4 real?

| rgn | axis | mean enemy HP per seed | mean | spread | mean / axis |
|---|---|---|---|---|---|
| 3 | ×3.84 | 53.7 52.7 53.2 48.3 61.9 | 53.9 | ×1.28 | 14.0 |
| 4 | ×4.33 | 52.3 48.9 55.4 56.2 49.7 | 52.5 | ×1.15 | 12.1 |
| 5 | ×5.29 | 60.8 55.5 60.0 64.1 65.1 | 61.1 | ×1.17 | 11.6 |
| 6 | ×6.02 | 69.3 70.1 61.9 71.0 69.1 | 68.3 | ×1.15 | 11.3 |

Seed-averaged, the 3→4 band is **×0.97** against the axis's ×1.13 — and the
within-region seed spread (×1.15–1.28) is larger than the band difference.
**Band 3→4 is inside the noise and is not a tuning target.**

One thing the table does show: the `mean / axis` column declines 14.0 → 11.3
across regions 3–6. Once the world axis is divided out, the fallback roster
contributes *less* per body in later regions — that is spawn composition (which
units a profile draws), not the axis, and it is a **regions 3–8 have no authored
rosters** artifact. Provisional; re-check when real rosters land.

## 7. T5 — concentration against spread

Measured as clear time on a region-8 room, per the brief, not as overkill.

| class | shape | outcome | secs | kills | min HP% |
|---|---|---|---|---|---|
| priest | concentrated | cleared | 162.9 | 669 | 38.4 |
| priest | spread | cleared | 145.7 | 626 | 61.8 |
| savage | concentrated | cleared | 119.8 | 603 | 88.8 |
| savage | spread | cleared | 119.8 | 599 | 89.3 |
| hunter | concentrated | DIED | 18.8 | 15 | 0.0 |
| hunter | spread | DIED | 17.5 | 11 | 0.0 |
| monk | concentrated | DIED | 29.8 | 63 | 0.0 |
| monk | spread | DIED | 27.8 | 62 | 0.0 |

**Concentration is not punished.** Spread is 12% faster for the priest (and much
safer — 61.8% min HP against 38.4%), *identical* for the savage, and irrelevant
for the two classes that die either way.

**Which mechanism is missing.** Both shapes field eight slotted skills; the only
difference is where the ranks went. So concentration's sole downside today is
that its damage sits behind one skill's cooldown — and rank *shortens* that
cooldown (`SKILL_RANK_CD_RATE` 0.97/rank to a 0.70 floor), partially refunding
the very penalty that was supposed to bite. Nothing else in the system prefers
breadth. **A mechanism would have to be added, not tuned** — reported per the
brief rather than invented here.

## 8. T3 — sustain against incoming

Region-8 room, first 15 s, all 14 classes. `_heal gross` is every HP the kit
asked for, overheal included — the quantity a per-second cap would bite on.

| class | _heal gross/s | _heal eff/s | skill eff/s | taken/s | eff/taken | **gross/taken** |
|---|---|---|---|---|---|---|
| savage | **38.5** | 2.7 | 0.1 | 2.8 | 1.00 | **×13.75** |
| priest | 5.9 | 5.1 | 0.0 | 5.1 | 1.00 | **×1.16** |
| monk | 3.3 | 2.2 | 0.0 | 5.3 | 0.42 | ×0.62 |
| bard | 0.0 | 0.0 | **2.1** | 5.5 | 0.39 | ×0.00 |
| witch doctor | 0.7 | 0.7 | **2.2** | 7.7 | 0.37 | ×0.09 |
| sundian | 0.0 | 0.0 | **1.5** | 8.9 | 0.17 | ×0.00 |
| wizard | 1.0 | 0.9 | 0.0 | 7.1 | 0.13 | ×0.14 |
| blacksmith, necromancer, druid, mage, samurai, assassin, hunter | 0.0 | 0.0 | 0.0 | 0.2–6.5 | 0.00 | ×0.00 |

**Two classes out-heal the room, and one of them by ×13.8.** The savage's leech
is fed by its own damage, and its damage is fed by `cascade`, which is uncapped
by design — so its sustain inherits an unbounded engine. That is the outlier, and
it is the same root cause as §13 rule 90.

### The lever T3 names does not reach two of these classes

`js/compose.js` writes `p.hp` **directly** in three places — the `heal`
primitive (`:452`), `drain`'s lifesteal (`:483`) and the `healPerHit` rider
(`:609`). Skill-composed healing therefore never passes through `_heal`, and so
skips the `recovery` multiplier, the `healHalf` curse, and the Priest's Grace
hook.

Measured: a level-82 **bard takes zero `_heal` calls in 15 s and still gains 31.8
HP.** The sundian is the same. A cap written against `_heal` — T3's stated lever
— would not touch either of them, and would only partly touch the witch doctor.

**Any sustain cap must cover both doors or it will simply relocate the problem
to the door it does not watch.** Reported, not fixed.

---

## What this pass did not measure

- **T4 (rank is felt).** A tuning target, not a measurement in the brief's list.
  Phase 1's rank figures stand.
- **Boss fights.** Every figure here is a plain combat node.
- **Party sizes above solo.** All measurements are 1p.
- **Real play.** `driveEngage` never kites or retreats, so the ten deaths in §5
  are a floor on difficulty and the clear times are a ceiling.

## Standing caveat

**Regions 3–8 have no authored rosters** and fall back to the base 12-enemy
table. Every per-body figure for those regions is provisional and must be
re-checked when real rosters land — including §6's declining `mean / axis`
column, which may be an artifact of the fallback table rather than a property of
the design.
