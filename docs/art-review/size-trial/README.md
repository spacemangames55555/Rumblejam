# Size trial — 256, 128, and the display maths

Two questions: what size do units actually render at, and does a larger, smoother
sheet read better than the 32px pixel art currently approved.

**Answers: 256 is impossible, 128 is possible but measurably worse, and the
display size is 72 device pixels on a typical desktop — not 36.**

---

## 1. The display maths, measured

Measured in the running game, not derived. Probe:
`window.uvRenderer` + `CONFIG` at four viewports.

The renderer always shows exactly `ROOM_W × ROOM_H` = **1280 × 720 world units**,
so scale falls out of the canvas size and nothing else:

```
scale = min(canvas.width / 1280, canvas.height / 720)     // device px per world unit
canvas.width = window.innerWidth × dpr,  dpr capped at 2  // js/render.js _resize
```

A player is drawn at `2 × radius` = **32 world units** (`js/render.js`
`_drawPlayer` → `spriteScaleFor(id, r * 2)`, radius 16).

| viewport | dpr | canvas (device px) | scale | **rendered device px** | rendered css px |
|---|---|---|---|---|---|
| 1440×900 | 2 | 2880×1800 | **2.25** | **72** | 36 |
| 1920×1080 | 1 | 1920×1080 | **1.5** | **48** | 48 |
| 1280×800 | 2 | 2560×1600 | **2.0** | **64** | 32 |
| 851×393 (phone, landscape) | 2.6 → capped 2 | 1702×786 | **1.092** | **35** | 17.5 |

### Two corrections to the premise

- **The manifest declares 32, not 64.** It was 64 briefly in `457dc25`, then moved
  to 32 in `c66d897` — the change approved as "32×32 units, 64×64 bosses".
  `Assets.declared('char.pulsar')` returns `[32, 32]`.
- **Smoothing is OFF, not on.** `imageSmoothingEnabled` measured `false` at every
  viewport above. It is set in `Renderer._resize()` and a browser gate asserts it
  stays false across a resize. Nothing has turned it on.

### What that means

The right unit to design against is **device pixels**, because that is the actual
sampling grid — and it ranges **35 to 72**.

A 32px sheet is therefore always **upscaled**, by 1.09× to 2.25×. With smoothing
off that is a clean nearest-neighbour upscale, which is why the pixel art stays
crisp. It is never downscaled at any viewport tested.

A 256px sheet would be **downscaled 3.6×** on desktop and **7.3×** on a phone.
With smoothing off that is nearest-neighbour discarding roughly seven of every
eight pixels — aliasing, not downscaling. It would need either runtime smoothing
(which would blur every primitive too) or offline box-filtering. `resizeBox()` in
`tools/pngkit.mjs` was added for the latter and is what generated the comparisons
below.

---

## 2. 256 is impossible — three independent blockers

[`01-256-candidates-OPAQUE-unusable.png`](01-256-candidates-OPAQUE-unusable.png)
· sources in [`256-candidates/`](256-candidates/)

**Blocker 1 — no transparency.** The live schema states it outright:

> `no_background`: *"Generate with transparent background, **(blank background
> over 200x200 area)**"*

Above a 200×200 canvas the flag yields a flat opaque background instead of alpha.
Measured on all four candidates:

| candidate | size | transparent pixels |
|---|---|---|
| `256-candidates/A.png` | 256×256 | **0 / 65536** |
| `256-candidates/B.png` | 256×256 | **0 / 65536** |
| `256-candidates/E.png` | 256×256 | **0 / 65536** |
| `256-candidates/F.png` | 256×256 | **0 / 65536** |

The grey and purple boxes visible behind each figure in the comparison are those
backgrounds. `process_sprite.mjs` and `verify_art_batch.mjs` both refuse a fully
opaque sheet as a baked matte, correctly.

**Blocker 2 — cannot be rotated.** `/rotate` accepts a canvas of exactly 16, 32,
64 or 128 square. A 256 sheet can produce a south view and nothing else, so there
is no 8-direction set at that size.

**Blocker 3 — the downscale above.**

Any one of these is fatal. The largest size that is both transparent-capable
(≤200² area) and a legal rotate canvas is **128**.

---

## 3. 128 works, and is measurably worse

[`02-128-vs-32-at-real-device-sizes.png`](02-128-vs-32-at-real-device-sizes.png)
· sources in [`128-candidates/`](128-candidates/)

Columns: A, B, E, F at 128, then **B at 32 — the approved anchor** — for
reference. Top row is a 180px hero; bottom row is the same sheet box-filtered to
**72 / 48 / 35 device px**, the real in-game sizes from the table above.

Body contrast over the arena floor, accent-excluded, measured both at source and
after box-filtering to display size:

| candidate | at source | **at 72 device px** |
|---|---|---|
| `128-candidates/A.png` | −14 | **−11** (darker than the floor) |
| `128-candidates/B.png` | 15 | **20** |
| `128-candidates/E.png` | 6 | **12** |
| `128-candidates/F.png` | 10 | **16** |
| `batch0/candidates/B-vivid-arcade-SELECTED.png` (32px) | 94 | **96** |

Measuring after downsampling is the fair test — it is what a player sees, and it
rules out the objection that the gate is simply mis-calibrated for high-res art.
The gap does not close: the approved 32px art is **five times** the contrast of
the best 128px candidate, and hits the 94 target at **96**. None of the 128px
candidates clear even the gate floor of 45.

**Why.** At 128 the model has room to render realistically — dark shadows, dark
outlines, muted metal. At 32 it is forced into a small saturated palette because
there are not enough pixels for shading. The constraint that felt limiting is
precisely what produces art that reads on a near-black floor at 35–72 px.

**A second failure mode at 128**, visible in column B: the model composed an
entire **stone archway scene** around the character rather than an isolated
figure. Larger canvases invite environment. That alone disqualifies the size for
a sprite pipeline — a walking character cannot carry a doorway with it — and it
also depresses B's transparency to 34% and drags its measured body value down.

---

## 4. Recommendation

**Stay at 32×32 units / 64×64 bosses, and keep the approved anchor.**

The 256 request cannot be fulfilled at all, and the nearest viable size is worse
on the one metric that was set as the target. The hypothesis that the style might
read better smooth was worth testing and tested negative.

If more detail is still wanted, the lever that does not fight the display size is
**animation frames**, not canvas size — motion reads at 35 px where interior
detail does not.
