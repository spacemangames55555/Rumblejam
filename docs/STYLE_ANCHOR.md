# Style anchor

One unit is approved as the reference, and every subsequent generation reuses
its style clause **verbatim**. Consistency drift across 298 assets is the primary
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
grounded naturalistic fantasy, muted earthy palette of greens browns and leather, desaturated next to arcade colour, strong dark outline and deep shadow mass, warm mid-tone highlights on skin cloth and metal, readable silhouette with a distinctive head shape, no glow, no emissive rim, no neon
<!-- STYLE-CLAUSE-END -->

**This clause is written from the Druid, not verified against him.** It was
derived by measuring the shipped sheet (below) and describing what is there. It
has never been round-tripped — nobody has generated a unit from it and checked
that the result sits next to the Druid. **Do that on the first character of
batch 1 and compare before generating the other twelve.** If it does not
reproduce him, fix the clause then, while one sheet is downstream instead of
thirteen.

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

## The value gate no longer describes the anchor

The bands in `tools/verify_art_batch.mjs` were calibrated on arcade candidate B.
Against them the new anchor **fails two of three**:

| axis | band | Druid | |
|---|---|---|---|
| contrast | ≥ 45 | **22.7** | ✗ |
| accent spread | ≥ 90 | 93.4 | ✓ |
| body saturation | ≥ 0.58 | **0.387** | ✗ |

He is waived in `assets/gate-exceptions.json` and ships anyway. Retiring the
arcade anchor means those two bands are now **orphaned** — they describe art the
project no longer wants, and every character in the new direction will fail them
the same way.

**The bands have deliberately not been moved.** Two reasons. First, recalibrating
them on a single sheet would repeat the mistake that produced the reverted 109:
treating one asset's incidental numbers as a target. Batch 1 gives a spread to
calibrate against; one sheet does not. Second, the contrast axis is separately
known to be **wrong** — it computes a signed `bodyLuma − floorLuma`, so it goes
negative on lighter floors where the Druid is visibly *easier* to read. Fixing
the axis and recalibrating the band are the same job and should be done once,
with data.

Until then: measure, report the spread, waive, do not block. The gate still
rejects structural failures — wrong dimensions, empty cells, baked mattes,
collapsed rotations — and those are never waivable.

For the record, the bands as calibrated on the retired anchor:

| asset | contrast | spread | bodySat | |
|---|---|---|---|---|
| **B** — the arcade reference | 93.6 | 109.2 | 0.623 | inside all three |
| Pulsar 83 — front view | 83.0 | 115.0 | 0.650 | inside all three |
| Pulsar 109 — front view | 109.0 | 117.4 | **0.405** | rejected: saturation |
| A — too dark | **15.5** | **74.8** | 0.566 | rejected: contrast, spread |
| C — dark under a bright accent | **27.6** | 116.2 | **0.286** | rejected: contrast, saturation |

The 109 row is the one worth remembering: it cleared contrast *and* spread by
making the body pale, and only saturation caught it. **The gate rejects; it never
ranks.** No batch is selected by pushing any of these numbers up.

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
