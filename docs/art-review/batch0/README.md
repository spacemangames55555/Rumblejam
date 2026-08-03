# Batch 0 review artifacts

Every image referenced in the batch-0 discussion, with its provenance. Nothing
here is game art — `assets/sprites/` holds what the game loads. These are the
review record.

**Rule this directory exists to enforce:** no visual artifact is delivered until
it is tracked, pushed, and opened. A file in a sandbox is not a deliverable, and
an image must never be described without the committed path it came from.

## Candidates

Four style directions, all Pulsar, all 32×32, all the **south** view only, all
seed 7, `low top-down`, `text_guidance_scale` 10, `no_background`.

| path | style params | body contrast over floor | outcome |
|---|---|---|---|
| [`candidates/A-bold-silhouette.png`](candidates/A-bold-silhouette.png) | `single color black outline`, `flat shading`, `low detail` | **16** | rejected — body sinks into the floor |
| [`candidates/B-vivid-arcade-SELECTED.png`](candidates/B-vivid-arcade-SELECTED.png) | `selective outline`, `basic shading`, `low detail` | **94** | **selected** |
| [`candidates/C-muted-emissive.png`](candidates/C-muted-emissive.png) | `single color outline`, `basic shading`, `medium detail` | **28** | rejected — dark body, brilliant accent; naive mean 79 would have passed it |
| [`candidates/D-lineless-painterly.png`](candidates/D-lineless-painterly.png) | `lineless`, `medium shading`, `medium detail` | 51 | rejected — the flame ate the figure |

[`01-four-candidates.png`](01-four-candidates.png) — the four side by side: 4×
hero, then four copies at true 36 css px in-game size, on the arena floor.

## The first 64px attempt (superseded)

Generated before the size decision, with the original silhouette-note prompt.

- [`02-first-64px-8rows.png`](02-first-64px-8rows.png) — E SE S SW W NW N NE at 4×.
- [`03-first-64px-at-game-size.png`](03-first-64px-at-game-size.png) — the same
  sheet at 36 css px, at crowd density. This is the image that failed review:
  dim, mushy, no sternum ring.
- [`04-size-probe-64-vs-32.png`](04-size-probe-64-vs-32.png) — left: that anchor;
  middle: improved prompt at 32px; right: same at 64px. All at 36 css px. The
  evidence for moving unit sheets to 32×32.
- Sources: [`sources/01-first-64px/`](sources/01-first-64px/) — 8 files, 64×64.

## Rotation gate

Both sets are candidate B with the flame removed, 32×32, same base south view.

| path | method | opposite/adjacent separation | outcome |
|---|---|---|---|
| [`05-B-direct-rotation-8rows-REJECTED.png`](05-B-direct-rotation-8rows-REJECTED.png) | one hop from south to each facing, `image_guidance_scale` 3.0 | **0.55** | rejected — opposite facings resemble each other more than neighbours |
| [`07-B-chained-rotation-8rows-ACCEPTED.png`](07-B-chained-rotation-8rows-ACCEPTED.png) | 45° hops around the compass, `image_guidance_scale` 1.5 | **1.03** | accepted |

[`06-B-direct-rotation-EWSN.png`](06-B-direct-rotation-EWSN.png) — rows 0/4/2/6
(E, W, S, N) from the rejected set at 10×, showing E and W nearly identical.

Sources: [`sources/02-B-direct-rotation/`](sources/02-B-direct-rotation/) and
[`sources/03-B-chained-rotation/`](sources/03-B-chained-rotation/), 8 files each.

## What is committed as the anchor

`assets/sprites/char/pulsar.png` — 32×256, assembled from
`sources/03-B-chained-rotation/`.

**It is not the same image as `candidates/B-vivid-arcade-SELECTED.png`.** B was
a single south view generated with the original B prompt, which included the
flaming crown. The committed anchor is a **re-generation** with the flame
removed and `plain smooth rounded helmet` added — the change requested at
selection — then chain-rotated and assembled.

Measured like for like:

| asset | what is measured | contrast over floor |
|---|---|---|
| `candidates/B-vivid-arcade-SELECTED.png` | one south view | **94** |
| `assets/sprites/char/pulsar.png`, row 2 (S) | one south view | **83** |
| `assets/sprites/char/pulsar.png`, all 8 rows | the whole sheet | **66** |

The 94-vs-66 comparison made earlier was not like for like: it set a single
front view against an eight-row average, and back-facing rows are darker. On the
same view the flame-removal regeneration is **11 contrast darker** than the
approved candidate. The gate threshold is 45, so it passes, but the style being
propagated into ~60 units is an 83-contrast front view, not a 94.
