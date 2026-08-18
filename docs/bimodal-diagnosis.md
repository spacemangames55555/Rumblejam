# Why some classes die in a region-8 room and others don't

Diagnosis only. Nothing here changes the game. Reproduce with
`node tools/bimodal_diagnosis.mjs --seeds=3`.

---

## The answer, in three lines

**It is not sustain.** Sustain explains two classes and nothing else; capping it
would help none of the eight that die and would push the middle into them.

**Every death is attrition** — 8 of 8, unanimously. Nothing bursts.

**The roster shares one defensive clock, and three classes have found an exit
from it.** Two exit through sustain, one through mitigation. The other eleven
are on the clock and differ mostly in how long it takes.

---

## First, a correction to the premise

The brief describes 10 of 14 dying, 4 surviving, "no middle". That was measured
on **one seed**. On three:

| class | died | mean secs | mean min HP% | group |
|---|---|---|---|---|
| savage | 0/3 | 113.8 | 90.8 | **survivor** |
| priest | 1/3 | 93.9 | 45.0 | mixed |
| samurai | 2/3 | 73.8 | 21.6 | mixed |
| monk | 2/3 | 57.5 | 21.7 | mixed |
| necromancer | 2/3 | 57.3 | 7.3 | mixed |
| sundian | 2/3 | 51.6 | 20.1 | mixed |
| blacksmith | 3/3 | 39.6 | 0.0 | dies |
| druid | 3/3 | 34.1 | 0.0 | dies |
| assassin | 3/3 | 28.0 | 0.0 | dies |
| witch doctor | 3/3 | 27.1 | 0.0 | dies |
| wizard | 3/3 | 26.6 | 0.0 | dies |
| hunter | 3/3 | 23.8 | 0.0 | dies |
| mage | 3/3 | 23.7 | 0.0 | dies |
| bard | 3/3 | 23.1 | 0.0 | dies |

**1 always survives, 5 sometimes, 8 never.** Survival is a smooth gradient from
23.1 s to 113.8 s. The "no middle" was §13 rule 94 catching the phase-2 report's
own headline: a single-seed comparison in a procedurally generated room measures
the seed as much as the subject. The bimodality is real at the ends and there is
a populated middle between them.

This matters for the fix. "Two modes" invites a switch; a gradient with three
outliers at the top invites finding out what those three did.

## Burst or attrition — unanimous

| class | secs | 1st hurt | worst second | above 90% | verdict |
|---|---|---|---|---|---|
| blacksmith | 39.6 | 4.5 s | 8.9% | 27.8% | attrition |
| druid | 34.1 | 3.4 s | 11.1% | 37.4% | attrition |
| assassin | 28.0 | 5.4 s | 16.0% | 35.3% | attrition |
| witch doctor | 27.1 | 2.9 s | 12.5% | 26.3% | attrition |
| wizard | 26.6 | 4.3 s | 14.5% | 34.1% | attrition |
| hunter | 23.8 | 4.2 s | 13.6% | 29.3% | attrition |
| mage | 23.7 | 3.6 s | 12.3% | 28.5% | attrition |
| bard | 23.1 | 2.8 s | 14.1% | 31.4% | attrition |

**0 burst, 8 attrition.** The worst single second costs 8.9–16.0% of max HP —
nobody is one-shot, nobody is caught by a spike. The traces are clean monotone
grinds:

```
blacksmith  1 .99 .99 .99 .97 .97 .93 .91 .90 .90 .86 .81 .78 .74 .68 .65 .63
            .58 .54 .51 .48 .44 .37 .33 .25 .15 .08
```

Health never comes back. **This is the single most decision-relevant number in
the diagnosis**: attrition and burst need opposite fixes, and a healing cap is
the wrong direction for every one of these eight.

## What separates them — everything measured, most ruled out

Spearman ρ against mean seconds survived, over all 14 classes. Group means are
printed beside it, but the correlation is the load-bearing analysis: with one
always-survivor a two-group mean is a sample of one wearing a category's name.

| channel | ρ (all 14) | ρ (savage removed) | verdict |
|---|---|---|---|
| kills/s | **0.91** | 0.88 | holds — but see below |
| output DPS | **0.89** | 0.86 | holds — but see below |
| `_heal` gross | 0.68 | 0.59 | **was largely the savage** |
| vitality | 0.61 | 0.54 | weak |
| grit | 0.35 | 0.39 | weak |
| raw incoming | 0.30 | 0.22 | ruled out |
| mitigation ratio | 0.19 | 0.34 | ruled out |
| compose.js healing | **0.08** | 0.01 | **ruled out** |
| minions on field | −0.08 | −0.01 | ruled out |
| shield absorbed | −0.03 | 0.10 | ruled out |
| speed | −0.18 | −0.48 | ruled out |
| capstone ratio (deep/shallow) | **0.08** | | **ruled out** |
| item lift | **−0.26** | | **ruled out (slightly inverted)** |

Three of the brief's named candidates are dead: **capstone variance** (ρ 0.08),
**the item spread** (ρ −0.26 — the hunter's +51.8% lift is the *shortest*-lived
class), and the **samurai/savage measurement gaps** — the savage's cascade
sustain is real but it is one class, and the samurai's staging gap does not
touch its survival.

### And throughput is weaker than it first looks

Kill rate at ρ 0.91 looked like the answer. It is inflated by censoring: a class
that lives longer is measured across a longer, denser stretch of the room.
Re-measured over a **fixed 15 s window**, identical for every class:

| | ρ against survival |
|---|---|
| kills/s over each run's own length | 0.91 |
| **kills/s over a fixed 15 s** | **0.56** |
| DPS over each run's own length | 0.89 |
| **DPS over a fixed 15 s** | **0.29** |

Early throughput is a weak predictor. The necromancer posts 352.9 DPS in the
first 15 s and lives 57.3 s; the druid posts 317.3 and lives 34.1 s; the wizard
posts 263.2 and lives 26.6 s. Throughput matters, but it is not the axis.

## The clock

Nothing above explains the gradient once censoring is removed, and every death
is attrition. That combination points at a mechanism rather than a stat.

Same fixed 15 s window, every class:

| class | lived | vit | mitigation | net in/s | heal/s | **drain/s** | predicted |
|---|---|---|---|---|---|---|---|
| savage | 113.8 | 196 | 0.74 | 2.8 | 2.8 | **0.0** | **never** |
| priest | 93.9 | 196 | 0.92 | 5.1 | 5.1 | **0.0** | **never** |
| samurai | 73.8 | 196 | **1.00** | 0.2 | 0.0 | **0.2** | **never** |
| monk | 57.5 | 186 | 0.88 | 5.3 | 2.2 | 3.1 | 60.7 |
| necromancer | 57.3 | 192 | 0.82 | 4.9 | 0.0 | 4.9 | 39.5 |
| sundian | 51.6 | 176 | 0.82 | 8.9 | 1.5 | 7.4 | 23.9 |
| blacksmith | 39.6 | 270 | 0.87 | 5.8 | 0.0 | 5.8 | 46.6 |
| druid | 34.1 | 186 | 0.80 | 4.5 | 0.0 | 4.5 | 41.0 |
| assassin | 28.0 | 161 | 0.85 | 3.7 | 0.0 | 3.7 | 43.9 |
| witch doctor | 27.1 | 186 | 0.89 | 7.7 | 2.8 | 4.9 | 38.0 |
| wizard | 26.6 | 186 | 0.79 | 7.1 | 0.9 | 6.2 | 30.0 |
| hunter | 23.8 | 186 | 0.86 | 6.5 | 0.0 | 6.5 | 28.8 |
| mage | 23.7 | 186 | 0.89 | 7.7 | 0.0 | 7.7 | 24.0 |
| bard | 23.1 | 176 | 0.89 | 5.5 | 2.1 | 3.3 | 52.5 |

**The roster is defensively uniform.** Mitigation spans 0.74–1.00 (×1.34);
vitality 161–270 (×1.68). Against that, survival spans ×4.9. A tight defensive
spread with a wide survival spread means the differences are not defensive.

**The top three all have drain ≈ 0, by two different mechanisms:**

- **savage** — heal 2.8 exactly cancels net incoming 2.8. Sustain.
- **priest** — heal 5.1 exactly cancels net incoming 5.1. Sustain.
- **samurai** — mitigation **1.00**, net incoming 0.2 HP/s. Not sustain at all:
  its footing shield eats essentially everything before HP is touched.

Everyone else drains 3.1–7.7 HP/s against ~186 HP, which is a 24–60 second
clock, and that is precisely the observed death window.

The clock predicts *whether* a class escapes, not *how long* the trapped ones
last: ρ(predicted, actual) is only 0.25 over the eleven it finishes. That is
expected — net incoming is measured early and a room ramps, so an early-window
prediction overestimates anyone who survives into the dense phase. It is a
threshold test, not a stopwatch.

---

## What this means for item 2

The brief asks: *"If the split is entirely sustain, item 2 fixes it and this
patch is smaller than it looks. Say so."*

**It is not, and item 2 alone would make the split worse.**

1. Sustain is the exit for **two** classes out of fourteen. Nine of the eleven
   clock-bound classes heal for under 2.2 HP/s and four heal for exactly zero.
2. Every death is **attrition**. A per-second healing cap subtracts from the
   `heal/s` column, which raises `drain` — the term that kills. It would move
   the priest, monk, witch doctor, bard and sundian *toward* the dying group and
   would not help any of the eight.
3. The largest sustain in the game is the savage's, and it is downstream of
   uncapped `cascade` — out of scope here by the brief's own scoping.

**Item 2 is still worth doing, but for its own reason rather than as the fix
for this.** Unifying the healing path is correct on the merits: three
multipliers currently do not apply to composed healing, `compose.js` healing has
ρ 0.01 with survival so unifying it cannot destabilise the roster, and a cap
written against `_heal` today would silently miss the bard and the sundian. That
is a correctness argument, not a balance one, and it should be scoped as one.

**What would actually address the gradient** — reported, not chosen, because the
brief says diagnose and stop:

- The samurai's exit is **mitigation**, and it is the only class with one. Eleven
  classes have no defensive answer to a room that out-spawns them at all.
- The eight that always die have no exit of any kind: no sustain, no mitigation
  above the roster's uniform 0.79–0.89, no screening (minions ρ −0.08), no
  mobility advantage (speed ρ −0.18).
- The exits that exist are all-or-nothing. `drain 0.0` or `drain 4.9` — there is
  nothing partial, which is why the ends look bimodal even though the middle is
  populated.

---

## Method notes

- `driveEngage` advances on the nearest enemy and holds at 110. It never kites or
  retreats, so every death here is a **floor** on difficulty.
- Runs are capped at 120 s, so survivors' lifetimes are censored. The censoring
  understates rather than overstates the correlations, which is the safe
  direction.
- Shallow spend throughout. Capstone variance is tolerated (rule 86) and measured
  only to rule it out as the cause of the split.
- Region 8 has **no authored roster** and falls back to the base 12-enemy table,
  so the absolute incoming figures are provisional (GDD §4.3).
