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
