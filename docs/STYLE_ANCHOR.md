# Style anchor

One unit is generated first, approved, and then never re-rolled. Every
subsequent generation reuses its style clause **verbatim**. Consistency drift
across 298 assets is the primary failure mode of the art phase, and this is the
only defence against it.

The anchor is **Pulsar** — close-combat nova character, the reference
implementation of engine-not-multiplier, and the most visually distinctive
thing in the roster.

## Status

**Anchor is the 83 sheet, restored.** `assets/sprites/char/pulsar.png`,
assembled from the chained rotation in
[`art-review/batch0/sources/03-B-chained-rotation/`](art-review/batch0/sources/03-B-chained-rotation/)
and preserved verbatim at
[`art-review/anchor-94/00-previous-anchor-83.png`](art-review/anchor-94/00-previous-anchor-83.png).
Awaiting final sign-off.

A regeneration that scored 109 on body contrast was generated, committed, and
then **reverted**. It hit the number by making the body pale, which drifted the
palette off the approved reference and left it with no accent structure at all —
and accent hue is the third discriminating axis for all 60 units in
`SILHOUETTE-VOCABULARY.md`. The evidence is in
[`art-review/anchor-94/`](art-review/anchor-94/).

**The 94 figure was never a target.** It was candidate B's incidental score.
Treating it as a goal is what produced the 109. The value gate now expresses a
*region* on three axes instead of a single number, and it rejects rather than
ranks — see `tools/verify_art_batch.mjs`.

## The clause

Everything between the two markers is copied byte-for-byte into every prompt by
`tools/gen_prompts.mjs`. Do not paraphrase it anywhere — paraphrasing *is*
drift, and it is invisible until forty sprites disagree.

<!-- STYLE-CLAUSE-START -->
plain smooth rounded helmet, vivid saturated arcade palette, crisp readable shapes, body mid-to-light in value so it never sinks into a near-black floor, one bright accent only, bright colours that pop against a near-black floor
<!-- STYLE-CLAUSE-END -->

The value phrase is not decoration, and neither is "one bright accent only".
Two of the four candidates failed review because the body sat too close in
luminance to the arena floor, and one of those carried a brilliant accent that
made it look fine on a naive check. `tools/verify_art_batch.mjs` measures all of
it afterwards, with the accent excluded, on three bands.

## The value region

The gate is a **region, not a scoreboard**. It rejects; it never ranks. Nothing
it prints should be maximised, and no batch should ever be selected by pushing
one of these numbers up — doing exactly that is what produced the reverted 109.

| axis | band | what it catches |
|---|---|---|
| contrast | ≥ 45 | body sinks into the arena floor |
| accent spread | ≥ 90 | no accent at all — a flat silhouette |
| body saturation | ≥ 0.58 | body washed out to lift its luminance |

The brightest quarter is excluded before the body is measured on every axis, so
a brilliant accent can never mask a dark or desaturated body.

Measured, front view and whole sheet:

| asset | contrast | spread | bodySat | |
|---|---|---|---|---|
| **B** — approved reference | 93.6 | 109.2 | 0.623 | inside all three |
| **83 anchor** — front view | 83.0 | 115.0 | 0.650 | inside all three |
| **83 anchor** — whole sheet | 65.6 | 131.6 | 0.676 | inside all three |
| **109 anchor** — front view | 109.0 | 117.4 | **0.405** | rejected: saturation |
| **109 anchor** — whole sheet | 92.2 | 136.7 | **0.540** | rejected: saturation |
| A — too dark | **15.5** | **74.8** | 0.566 | rejected: contrast, spread |
| C — dark under a bright accent | **27.6** | 116.2 | **0.286** | rejected: contrast, saturation |

The 109 is the instructive row: it cleared contrast *and* spread and is still
wrong. Only saturation sees it.

## Record

| field | value |
|---|---|
| generator | PixelLab API, `https://api.pixellab.ai/v1` (`openapi.json` version `dev`) |
| base view endpoint | `POST /generate-image-pixflux` |
| rotation endpoint | `POST /rotate`, **45° hops** — see below |
| canvas | 32×32 (`char.`/`enemy.`), 64×64 (`boss.`) |
| `view` | `low top-down` |
| `direction` (base) | `south` |
| `seed` | `7` |
| `text_guidance_scale` | `10` |
| `outline` | `selective outline` |
| `shading` | `basic shading` |
| `detail` | `low detail` |
| `negative_description` | `flames, fire, smoke, flaming crown, spikes on head` |
| `image_guidance_scale` (rotate) | `1.5` |
| exact base prompt | `Pulsar, a compact melee nova-caster dungeon adventurer, arms held wide and low, a glowing ring at the sternum, plain smooth rounded helmet, vivid saturated arcade palette, crisp readable shapes, bright colours that pop against a near-black floor` |
| cost | 8 generations per unit (1 base + 7 rotations) |
| date | 2026-08-03 |
| approved by | *(pending final sign-off)* |

There is no reference-image parameter on `pixflux`. `generate-image-bitforge`
does take `style_image` + `style_strength`, so once this sheet is signed off it
can be passed as a real style reference for every subsequent unit rather than
relying on the text clause alone — a materially stronger consistency guarantee.
Worth measuring on the first few of batch 1 before committing to it.

## Rotation must be chained

**Do not rotate from the base view to each facing in one hop.** Asking `/rotate`
for 180° at once makes it preserve far too much of the source: the back view
comes out looking like the front. Measured on real units, opposite facings ended
up *more* similar to each other than neighbouring ones — a separation ratio of
0.55, where anything under 1.0 means the eight rows are not really eight
drawings. This held at 64×64 as well as 32×32, so it is the method, not the
canvas.

Walking the compass in 45° hops, each conditioned on the previous hop's output,
takes that ratio to **1.03** and produces a back view that is actually a back
view. `tools/gen_unit.mjs` does this by default;
`tools/verify_art_batch.mjs` fails any 8-direction sheet whose ratio drops below
0.85.

## The rule

**Never re-roll the anchor once batch 1 begins.** A changed anchor invalidates
every asset generated before it, and there is no cheap way to tell which ones
drifted. If the anchor turns out to be wrong, that is a decision to regenerate
everything downstream of it — make it deliberately, and record it here with the
date and the reason.
