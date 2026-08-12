# Style anchor

One unit is approved as the reference, and every subsequent generation reuses
its style clause **verbatim**. Consistency drift across 312 assets is the primary
failure mode of the art phase, and this is the only defence against it.

The anchor is **the Druid** — `char.toh_druid`, Thrones of Heaven roster.

## Status

**Anchor: `assets/sprites/char/toh_druid.png`**, 128×1024, eight facings,
sources preserved verbatim in
[`art-review/druid/sources/`](art-review/druid/sources/). Installed and shipping
at an effective 2.25× (`scale: 2.18` against measured content). Review and
measurements: [`art-review/druid/README.md`](art-review/druid/README.md).

### Pulsar and the arcade style are retired — 2026-08-04

The previous anchor was **Pulsar**, `assets/sprites/char/pulsar.png`, in a vivid
saturated arcade palette. It is retired, not deleted: the sheet stays installed
and the record below stays readable, because it explains where the value bands
came from and why they no longer fit.

The reason is that the art direction moved. The Druid is the style the game is
actually going toward, and an anchor that no longer describes the roster is worse
than no anchor — it makes every future prompt ask for the wrong thing.

**This is the "regenerate everything downstream" decision the rule at the bottom
warns about, made deliberately.** Almost nothing is downstream: exactly one sheet
(Pulsar's own) was generated under the arcade clause, and batch 1 had not
started. That is why the switch is affordable now and would not have been in a
month.

## The clause

Everything between the two markers is copied byte-for-byte into every prompt by
`tools/gen_prompts.mjs`. Do not paraphrase it anywhere — paraphrasing *is*
drift, and it is invisible until forty sprites disagree.

<!-- STYLE-CLAUSE-START -->
grounded naturalistic fantasy, low-key value structure: true black outline and shadow mass at the darkest value in the palette, body in low mid-tones below middle grey, highlights sparing and small in area, never a pale or washed-out body, muted earthy palette of greens browns and leather held low in value, desaturated next to arcade colour, warm highlights on skin cloth and metal, readable silhouette with a distinctive head shape, no glow, no emissive rim, no neon
<!-- STYLE-CLAUSE-END -->

**This clause was written from the Druid, and it has now been round-tripped
against him. IT DOES NOT REPRODUCE HIM.** Full record and images:
[`art-review/anchor-roundtrip/`](art-review/anchor-roundtrip/README.md).

One unit — `enemy.pnw_bark_hulk` — generated from this clause with the anchor's
own south cell as the style reference. 8 generations, 117 s. Against the anchor:

| | Druid | from the clause |
|---|---|---|
| luma median | 56 | **119** |
| luma p25 | 24 | **56** — the shadows land on the anchor's midtone |
| darkest 15% mean | **0.3** | **16.2** — the true black is simply absent |
| saturation median | 0.42 | 0.52 |
| near-grey | 13.7% | 2.3% |

The body came back pale peach where the anchor is dark green and leather. That
is the failure this document already predicted for the *previous* anchor's
metric — "maximising it rewards a uniformly pale body, which is the opposite
failure and one the gate cannot see" — arrived at from the other direction.

The clause names a **palette** and never names a **value structure**, and the
anchor's identity is the distribution: dark floor, broad mid-tone, small bright
tail. "strong dark outline and deep shadow mass" is carrying that whole claim
and is not getting it.

**No batch may run against an unproven clause.** The loop is: edit the clause,
regenerate one unit (8 generations), compare. Only when a generated unit sits
next to the Druid does a batch start. The silhouette notes are NOT implicated —
the shape brief came back accurately — so this is a clause edit, not a content
one.

### Attempt 2 — the clause now names value structure

The clause above was rewritten after that result. **The anchor's identity is
where the darks are, and the old clause never said so.** It named a palette
("muted earthy greens browns and leather") and left the value distribution to
"strong dark outline and deep shadow mass", which was carrying the entire claim
and did not get it. Four changes:

1. **Value structure leads**, before any colour word: *low-key value structure*.
2. **The black floor is named as a floor** — *true black outline and shadow mass
   at the darkest value in the palette*. The failure was shadows landing on
   midtone; the clause now says where the bottom is.
3. **The body is placed** — *low mid-tones below middle grey* — and highlights
   are bounded to *sparing and small in area*, which is the small bright tail.
4. **The observed failure is forbidden by name**: *never a pale or washed-out
   body*. Palette is demoted to a modifier of value — *held low in value*.

**These are the numbers the round trip is judged against**, taken from the
anchor itself rather than from taste. Landing the value distribution is the pass
condition — not to the digit, but it has to stop being a quartile too bright
with no black in it.

### It did not land. THE CLAUSE ABOVE IS TESTED AND FAILING.

| | target (the Druid) | attempt 1 | attempt 2 (this clause) |
|---|---|---|---|
| luma median | **~56** | 119 | **109** |
| luma p25 | **~24** | 56 | 49 |
| luma p95 | 174 | 173 | 189 |
| darkest 15% mean | **~0** | 16.2 | **17.1** |
| saturation median | ~0.42 | 0.52 | 0.56 |
| near-grey | 13.7% | 2.3% | 2.1% |

A 10-point median shift against the 53 needed. The black floor moved the wrong
way; so did saturation. Naming the value structure four separate ways — leading
with it, naming the floor, placing the body, forbidding the failure outright —
bought essentially nothing.

**The conclusion is about the lever, not the wording.** Prose is not what
governs value here. Two things have never been tried, and both speak the API's
own vocabulary instead of free text:

1. **`style_strength` is 50.** The reference image is the Druid's own cell,
   which already *has* the target distribution exactly. At 50 it is plainly not
   dominating the text. 75 or 90 is one flag and 8 generations.
2. **`outline`, `shading` and `detail` are typed enum parameters this API
   exposes, and nothing in this pipeline has ever set one.** `gen_unit.mjs`
   already passes them through as flags. `outline: "single color black outline"`
   addresses the exact thing that is missing, in the API's own terms, rather
   than asking for it in a sentence.

We have been describing in prose what the endpoint takes as parameters. That is
the next experiment, and it is a ruling to make rather than one for me to spend
on.

**This clause stays in place, marked failing rather than reverted** — the
previous one failed too, and its reasoning is worth keeping for whoever runs
attempt 3. No batch may run against it.

## What the anchor actually measures

Whole sheet, all eight facings, 42,051 opaque pixels:

| | |
|---|---|
| luma percentiles | p05 **0** · p25 24 · median 56 · p75 99 · p95 174 · max 227 |
| saturation | p25 0.31 · median 0.42 · p75 0.53 · p95 0.63 |
| darkest 15% | mean luma **0.3** — a true-black outline and shadow mass |
| near-grey (sat < 0.15) | 13.7% |
| dominant hues | yellow-green 19.3% · red 14.2% · rose 10.5% · orange 9.8% · cyan 9.0% |
| content | 90×124 of a 128 cell — fills 96.9% of cell height |

The shape of that distribution is the style: **a very dark floor of outline and
shadow, a broad mid-tone body, and a small bright tail.** Median luma 56 with a
p95 of 174 is a wide value range anchored low. The old arcade clause asked for
the opposite — "body mid-to-light in value" — which is exactly why it had to go.

## The aesthetic gates are retired

The bands in `tools/verify_art_batch.mjs` were calibrated on arcade candidate B.
Against them the new anchor failed two of three, and the first batch-1 character
failed all three:

| axis | band | Druid | Hunter |
|---|---|---|---|
| contrast | ≥ 45 | **22.7** ✗ | **13.3** ✗ |
| accent spread | ≥ 90 | 93.4 ✓ | **80.9** ✗ |
| body saturation | ≥ 0.58 | **0.387** ✗ | **0.570** ✗ |

They were **retired on 2026-08-04** rather than recalibrated or waived thirteen
more times. The full reasoning is in `docs/SPRITES.md`, *"Why there are no
aesthetic gates"*; the short form is that they were calibrated on an abandoned
art direction, they disagreed with each other as soon as there were two
characters to compare (the Hunter is markedly darker *and* markedly more
saturated than the anchor, so no single recalibration makes both axes right),
the contrast axis was measurably wrong because it was signed, and it was least
reliable at exactly the display size where readability matters most.

`assets/gate-exceptions.json` is now empty. The gate checks structure only —
dimensions, decodability, empty cells, baked matte, `content` present and
matching the file — plus facing separation, which is a broken-sheet check rather
than a taste one and was calibrated on the rotation method, not on any palette.

**Consistency judgement lives in the contact sheet**,
[`art-review/batch1/00-toh-installed.png`](art-review/batch1/00-toh-installed.png),
which is where it was actually happening the whole time.

What is still enforced numerically is **size**, because size has a right answer:
every sheet renders its silhouette at the same height. `scale: 2.18` is
confirmed for the roster — the Druid's playtest cleared on 2026-08-04 with the
silhouette holding, no mirroring, and projectiles reading as coming from him.

For the record, the retired bands as calibrated on the retired anchor:

| asset | contrast | spread | bodySat | |
|---|---|---|---|---|
| **B** — the arcade reference | 93.6 | 109.2 | 0.623 | inside all three |
| Pulsar 83 — front view | 83.0 | 115.0 | 0.650 | inside all three |
| Pulsar 109 — front view | 109.0 | 117.4 | **0.405** | rejected: saturation |
| A — too dark | **15.5** | **74.8** | 0.566 | rejected: contrast, spread |
| C — dark under a bright accent | **27.6** | 116.2 | **0.286** | rejected: contrast, saturation |

The 109 row is still worth remembering, because it is the argument *for* having
had them: it cleared contrast and spread by making the body pale, and only
saturation caught it. A gate that rejects is worth having. A gate that is waived
every time is not, and that is what these became.

## Record

The Druid was **supplied as finished art**, not generated by the tooling in this
repo, so its generation parameters are not known here.

| field | value |
|---|---|
| generator | PixelLab (supplied externally) |
| source files | [`art-review/druid/sources/`](art-review/druid/sources/), eight 248×248 PNGs |
| endpoint, seed, guidance, prompt | **not recorded — unknown** |
| assembly | `tools/process_sprite.mjs --autocrop`, 248×248 → 97×124 union → 128 cell |
| cell | 128×128, `directions: 8` |
| content | `[90, 124]`, measured by `--record-content` |
| scale | `2.18` (× fit 1.0323 = 2.2503 effective) |
| date installed | 2026-08-03 / 2026-08-04 |
| approved by | Casey — size tuned against the floor grid |

**That missing row is a real gap.** The point of an anchor is that it can be
reproduced and extended; this one can only be *imitated*, through the text clause
above. Two things follow:

1. Recovering the original PixelLab parameters, if they still exist, is worth
   more than any amount of prompt-wording work.
2. Failing that, `generate-image-bitforge` takes `style_image` + `style_strength`.
   Passing the Druid's south view as a real style reference is a materially
   stronger consistency guarantee than a text clause, and it does not need the
   original parameters. **Measure it on the first unit of batch 1.**

## Rotation must be chained

Unchanged, and still the method for anything generated here.

**Do not rotate from the base view to each facing in one hop.** Asking `/rotate`
for 180° at once preserves far too much of the source: the back view comes out
looking like the front. Measured on real units, opposite facings ended up *more*
similar to each other than neighbouring ones — a separation ratio of 0.55, where
anything under 1.0 means the eight rows are not really eight drawings. This held
at 64×64 as well as 32×32, so it is the method, not the canvas.

Walking the compass in 45° hops, each conditioned on the previous hop's output,
takes that ratio to **1.03**. `tools/gen_unit.mjs` does this by default;
`tools/verify_art_batch.mjs` fails any 8-direction sheet below 0.85.

The Druid's own eight facings were supplied individually rather than rotated, and
measure **1.009** — so the band holds for hand-supplied sets too.

## The rule

**Never re-roll the anchor once batch 1 begins.** A changed anchor invalidates
every asset generated before it, and there is no cheap way to tell which ones
drifted. If the anchor turns out to be wrong, that is a decision to regenerate
everything downstream — make it deliberately, and record it here with the date
and the reason, as the Pulsar retirement above is recorded.
