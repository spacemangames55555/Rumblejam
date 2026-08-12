# The anchor round trip — 8 generations, and the answer is no

`STYLE_ANCHOR.md` has said this since the Druid was installed:

> **This clause is written from the Druid, not verified against him.** It was
> derived by measuring the shipped sheet and describing what is there. It has
> never been round-tripped — nobody has generated a unit from it and checked
> that the result sits next to the Druid.

This is that check. One unit, `enemy.pnw_bark_hulk`, generated from the live
clause with the anchor's own south cell as the style reference. **8 generations,
117 seconds, and the clause does not reproduce him.**

Everything here is the raw output at the md5 it arrived with. Nothing was
installed: `assets/` is untouched and the manifest is unchanged.

| | |
|---|---|
| command | `gen_unit.mjs enemy.pnw_bark_hulk --style=assets/sprites/char/toh_druid.png --style-strength=50 --seed=7` |
| style reference | the anchor sheet's **south cell**, cut at 128×128, no resampling |
| cost | **8 generations** — `usage.type` was `generations` on all 8 responses, `usage.usd` null |
| sources | [`sources/`](sources/), eight PNGs, verbatim |
| assembled | [`hulk-sheet.png`](hulk-sheet.png), 128×1024, review only — NOT installed |

## What it looks like

- [`01-eight-facings-2x.png`](01-eight-facings-2x.png) — Druid above, Bark Hulk
  below, all eight facings, on the arena floor colour.
- [`02-south-1x-2x-3x.png`](02-south-1x-2x-3x.png) — the south facing of each at
  1×, 2× and 3×. The 1× column is the one that matters: that is roughly the size
  the game paints.

## Finding 1 — the value distribution is a quartile too high, and the black is gone

Both sheets, all eight facings, opaque pixels only. Same measurements
`STYLE_ANCHOR.md` records for the anchor.

| | Druid (anchor) | Bark Hulk (from the clause) |
|---|---|---|
| opaque px | 42,051 | 54,777 |
| luma p05 | **0** | 12 |
| luma p25 | 24 | **56** |
| luma median | **56** | **119** |
| luma p75 | 99 | 157 |
| luma p95 | 174 | 173 |
| luma max | 227 | 254 |
| saturation median | 0.42 | 0.52 |
| **darkest 15%, mean luma** | **0.3** | **16.2** |
| near-grey (sat < 0.15) | 13.7% | 2.3% |

Read the three bold rows together:

- **Median luma 56 → 119.** The body is more than twice as bright.
- **The dark quartile lands on the anchor's median.** p25 of 56 is exactly the
  Druid's median — the Bark Hulk's *shadows* are as bright as the Druid's
  *midtones*.
- **The true black is absent.** `darkest 15% mean 0.3` is what
  `STYLE_ANCHOR.md` calls "a true-black outline and shadow mass". 16.2 is dark
  grey. The clause asks for "strong dark outline and deep shadow mass" in those
  words and did not get it.

Saturation went the wrong way too, against a clause that says "desaturated next
to arcade colour", and near-grey collapsed from 13.7% to 2.3%.

**This is a failure the document predicted.** Its own note on the retired
anchor's metric says: *"maximising it rewards a uniformly pale body, which is
the opposite failure and one the gate cannot see."* A pale body is what came
back — peach and apricot where the anchor is dark green, grey-blue and leather.

**The silhouette note is not implicated and is worth separating out.** The brief
was *"a squat trunk-bodied mass with two enormous knuckled forelimbs"* and that
is precisely what arrived. Shape briefs are working; the style clause is not.

## Finding 2 — the chain rotation did not produce a back view

The Druid's north facing is a real back view: cape from behind, no face, staff
in the other hand. The Bark Hulk's north facing **still shows the face, jaw and
chest**. It is a different pose, not a different facing.

That matters because `gen_unit.mjs` documents this exact failure as SOLVED:

> Asking `/rotate` for 180 degrees in a single hop makes it preserve far too
> much of the source: the "back" view comes out looking like the front. …
> Walking round the compass 45 degrees at a time … turns that ratio to 1.03 and
> gives a back view that is actually a back view.

This run used the chain. North is four hops from south. It came back frontal
anyway, so the chain is necessary and **not sufficient**, at least for a
wide quadrupedal-ish brute.

### And the metric that was supposed to catch it cannot

The recorded instrument is a ratio of opposite-facing difference to
neighbour-facing difference, where "anything under 1.0 means the eight facings
are not really eight".

| | opposite | neighbour | ratio |
|---|---|---|---|
| Druid | 27.1 | 25.8 | 1.05 |
| Bark Hulk | 40.9 | 15.9 | **2.58** |

The Bark Hulk scores **2.58**, far better than the anchor, while being visibly
wrong. The ratio measures *whether two images differ*, not *whether a facing is
correct* — and a rotate that returns a different frontal pose scores high
precisely because it differs. Same shape as the rest of this codebase's gate
failures: a number green about something other than what it claims (§13 rule
73). A real check needs to ask "is the face visible in the north facing", which
this does not.

## The recommendation

**Stop, and fix the clause before spending anything else.** 336 generations
across six regions against an unproven anchor is the wrong order, and this run
cost 8 to learn it — which is the whole reason `STYLE_ANCHOR.md` asked for it.

What the numbers suggest the clause is missing, offered as a starting point and
not as a ruling:

1. It describes a **palette** ("muted earthy palette of greens browns and
   leather") but not a **value structure**. The anchor's identity is the
   distribution — dark floor, broad mid-tone, small bright tail — and nothing in
   the clause says "most of this drawing is dark".
2. "strong dark outline and deep shadow mass" is doing all the work and is not
   getting it. It may need to be explicit and quantitative in the way art
   direction usually is not: *near-black outline, shadows at the darkest value
   in the palette, body mid-value, highlights sparing.*
3. The failure is the same one the retired arcade anchor hit from the other
   direction. That suggests the generator drifts pale under this family of
   prompts unless pushed, rather than that one word is wrong.

Rerunning after a clause edit is 8 more generations. That is the loop to be in
until a generated unit sits next to the Druid, and only then a batch.

---

# Attempt 2 — the clause was rewritten to name value structure. It did not land.

Same enemy, same anchor cell, same seed, same 8 generations and 117 s. The
clause was rewritten to lead with value rather than palette: *low-key value
structure, true black outline and shadow mass at the darkest value in the
palette, body in low mid-tones below middle grey, highlights sparing and small
in area, never a pale or washed-out body*, with palette demoted to *held low in
value*.

| | target (Druid) | attempt 1 | attempt 2 |
|---|---|---|---|
| luma median | **56** | 119 | **109** |
| luma p25 | **24** | 56 | 49 |
| luma p95 | 174 | 173 | 189 |
| darkest 15% mean | **0.3** | 16.2 | **17.1** |
| saturation median | 0.42 | 0.52 | 0.56 |
| near-grey | 13.7% | 2.3% | 2.1% |

- [`03-attempt2-vs-anchor.png`](03-attempt2-vs-anchor.png) — Druid, attempt 1,
  attempt 2, south facing at 1×/2×/3×.
- [`04-attempt2-facings.png`](04-attempt2-facings.png) — south beside north.
- [`attempt2-sources/`](attempt2-sources/), [`hulk-sheet-attempt2.png`](hulk-sheet-attempt2.png).

**Ten points of median against the fifty-three needed.** The black floor moved
the wrong way (16.2 → 17.1) and so did saturation. Visually it is the same pale
peach body with slightly more green in the mid-mass.

**So the finding is about the lever, not the wording.** The value structure was
named four separate ways — leading the clause, naming the floor, placing the
body, forbidding "pale or washed-out" by name — and bought almost nothing. It is
not that we failed to say it clearly.

Two levers have never been tried, and both speak the API's own vocabulary
instead of free text:

1. **`style_strength` is 50.** The reference is the Druid's own cell, which
   already carries the target distribution exactly. At 50 it is not dominating
   the text prompt. 75 or 90 is one flag.
2. **`outline`, `shading` and `detail` are typed enum parameters this endpoint
   exposes**, and nothing in this pipeline has ever set one — `gen_unit.mjs`
   passes them through as flags already. The live enum includes
   `"single color black outline"`, which is precisely the missing thing, asked
   for in the API's terms rather than in a sentence.

We have been describing in prose what the endpoint takes as parameters.

**North is still frontal in attempt 2.** Same failure, and
[`04-attempt2-facings.png`](04-attempt2-facings.png) makes it a one-glance call
— which is what `gen_facing_review.mjs` was added for after the ratio talked the
eye down at 2.58.

**Still stopped. 16 generations spent, no batch.**

---

# Attempt 3 — the API's own parameters. Closer, contaminated, still not landed.

`style_strength=85`, `outline="single color black outline"`,
`shading="medium shading"`, `detail="highly detailed"`. Same enemy, anchor cell
and seed. 8 generations, 115 s.

`shading` was chosen against the anchor rather than by feel, and the measurement
reversed the obvious guess. The Druid uses **115 distinct colours** with **45.6%
hard-edge pixels**; the generated attempts use ~1,500 colours at ~29%. The
anchor is tight, banded and crisp-stepped — the generations are smooth and
blended. So `"medium shading"`, not the `"detailed shading"` instinct suggested:
smooth blending is what averages the darks away.

| | target (Druid) | att1 prose | att2 prose | **att3 params** |
|---|---|---|---|---|
| luma median | **56** | 119 | 109 | **99** |
| luma p25 | **24** | 56 | 49 | 58 |
| luma p05 | **0** | 12 | 14 | **7** |
| darkest 15% mean | **0.3** | 16.2 | 17.1 | **9.4** |
| saturation median | 0.42 | 0.52 | 0.56 | 0.50 |
| near-grey | 13.7% | 2.3% | 2.1% | **5.6%** |
| distinct colours | **115** | 1436 | 1523 | **1639** |

- [`05-all-three-vs-anchor.png`](05-all-three-vs-anchor.png) — Druid and all
  three attempts, south at 1×/2×/3×.
- [`06-attempt3-facings.png`](06-attempt3-facings.png) — south beside north.
- [`attempt3-sources/`](attempt3-sources/), [`hulk-sheet-attempt3.png`](hulk-sheet-attempt3.png).

## Which lever moved the number

Both were changed at once, so this is inference from the shape of the change
rather than a controlled comparison — but the shape is unusually legible.

**The enums moved it, and specifically `outline`.** The darkest-15% mean nearly
halved (17.1 → 9.4) and p05 fell 14 → 7. That is the black floor arriving, and
it is precisely what `"single color black outline"` asks for. Near-grey more
than doubled toward the target. Body value moved 109 → 99 — the same order the
prose rewrite managed, so the enums did not fix the body either.

**`style_strength=85` moved iconography, not value — and that is a failure, not
a null result.** The attempt-3 Bark Hulk is carrying **the Druid's staff, his
crossbelt sash, and antlers**. At 85 the reference bled its *content* into the
subject; what came back is a green ogre holding somebody else's walking stick.

**And the colour count settles it.** We pushed 85/100 toward a reference with
**115 colours** and got **1,639** — more than either prose attempt. If style
transfer governed palette or value at all, that number would have collapsed
toward the reference. It went up.

So, in the terms this was framed in: the enums did it, and **the reference image
may not need to be the Druid** — stronger than that, at high strength it is
actively harmful, because it transfers props rather than style.

## Three negative results, and the decision that follows

Median 56 target; 119 → 109 → 99 across three attempts. **Not landed. Stopped at
three as agreed, no fourth.**

The honest read is not "nothing works" — the black floor genuinely improved, and
one more arm (body value alone: `"flat shading"`, low or no style reference) is
a coherent experiment. But three attempts on one target is the point at which
the question changes, and the evidence now points at something structural rather
than at tuning:

**115 colours against 1,639 is not a tuning gap, it is a different rendering
mode.** The anchor is a tight hand-authored palette with crisp value steps.
This endpoint produces near-continuous shading, and it did so through prose,
through a rewritten clause, and through its own typed style parameters at high
strength. Nothing available moved it below ~1,400 colours.

That is consistent with the pipeline's own history: **every shipped asset in
this game was hand-supplied.** The Druid's eight facings, all thirteen batch-1
characters, the bear. `gen_unit.mjs` has now been run three times and produced
nothing installable.

The decision is therefore not "which parameter next" but whether this API is the
right source for units at all, given the anchor it has to match. That is
yours — the options are a fourth parameter arm, a different anchor that this API
*can* reproduce, or continuing to hand-supply units and using generation for
something else.

**24 generations spent across three attempts. Nothing installed.**
