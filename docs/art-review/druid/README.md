# Druid — eight facings, painted at 1.5×, measured, and a floor sweep

`assets/sprites/char/toh_druid.png` · sources in [`sources/`](sources/)

## 1. Installed

**Eight facings, all hand-supplied.** The four diagonals (SE, SW, NW, NE)
arrived after the first four and completed the set, so nothing was
chain-rotated and nothing was invented to fill a gap. The sheet is now a plain
`directions: 8` grid in the standard row order — the per-sprite `directions`
override is gone, because eight *is* the category default.

The four cardinals are byte-identical to the ones installed before (`md5`
unchanged), so this is the same art with four rows added, not a re-supply.

Cell size is **128×128**, as before. The sources are **248×248** with the figure
occupying only ~97×124 of it, and `--autocrop` crops to the union of all content
first. The union across eight sources is **the same 97×124 box** it was across
four — the diagonals sit in register with the cardinals, which is why the figure
does not jitter between facings.

| | |
|---|---|
| file | `assets/sprites/char/toh_druid.png`, 128×1024 |
| manifest | `w:128 h:128 directions:8` (`directions` now the default, not an override) |
| rows | 0 E · 1 SE · 2 S · 3 SW · 4 W · 5 NW · 6 N · 7 NE |
| loader | accepted in the running game: `accepted: true`, `inMissing: false`, image 128×1024 |

[`02-installed-8rows.png`](02-installed-8rows.png) — the eight cells laid out as
a compass at 1:1, with a 36 device px strip beneath in sheet order.

[`03-ingame-8facings.png`](03-ingame-8facings.png) — the same eight drawn
**through the shipped `drawSprite()` path in the running game**, at 72 and 36
device px on the arena floor colour, stepping the heading 0° → 45° → … → −45°.
`drawSprite` returned `true` for all eight, and `dirIndex()` mapped each angle to
its own row with no offset:

```
E   0°  -> row 0 (E)      W  180°  -> row 4 (W)
SE  45° -> row 1 (SE)     NW -135° -> row 5 (NW)
S   90° -> row 2 (S)      N  -90°  -> row 6 (N)
SW 135° -> row 3 (SW)     NE -45°  -> row 7 (NE)
```

[`00-installed-4rows.png`](00-installed-4rows.png) is the earlier four-row
install, superseded by the above and kept only as the record of that state.

## 2. Measured, not gated

Against `#14161f`. **He still fails contrast and saturation.** Installed anyway,
waived in `assets/gate-exceptions.json`.

| | contrast (band ≥45) | spread (band ≥90) | bodySat (band ≥0.58) |
|---|---|---|---|
| whole sheet | **22.7** ✗ | 93.4 ✓ | **0.387** ✗ |
| row 0 E | **20.4** ✗ | 102.2 ✓ | **0.393** ✗ |
| row 1 SE | **16.4** ✗ | 104.2 ✓ | **0.401** ✗ |
| row 2 S | **18.0** ✗ | 100.8 ✓ | **0.334** ✗ |
| row 3 SW | **16.9** ✗ | 101.2 ✓ | **0.402** ✗ |
| row 4 W | **16.0** ✗ | 103.5 ✓ | **0.376** ✗ |
| row 5 NW | **27.2** ✗ | **81.9** ✗ | **0.397** ✗ |
| row 6 N | **32.3** ✗ | **80.9** ✗ | **0.391** ✗ |
| row 7 NE | **31.3** ✗ | **77.5** ✗ | **0.394** ✗ |

The front views are darker and carry more accent; the back views are lighter and
carry less. That is the cloak: from behind it is one broad green mass with the
face, beard, belt and staff-head all hidden, so there is less bright material to
form an accent quarter. The whole sheet passes spread on the strength of the
front and profile rows.

### Facing separation now passes

| | |
|---|---|
| opposite mean | 133.1 |
| adjacent mean | 132.0 |
| **ratio** | **1.009** (band ≥0.85) ✓ |

```
opposite   E/W 133   SE/NW 154   S/N 135   SW/NE 111
adjacent   E/SE 165  SE/S 113    S/SW 120  SW/W 147
           W/NW 146  NW/N 115    N/NE 120  NE/E 130
```

This is the number that read **0.82** on the four-row sheet, where the README
argued the band would not transfer to four directions because the "adjacent"
pairs were 90° apart rather than 45°. With the real eight rows in place it
clears the band without the band moving. The earlier 0.82 was an artifact of the
sheet shape, not a property of the art.

## 3. Painted at 1.5× — a manifest key, not a radius

The Druid is drawn through a new cosmetic `scale` multiplier in the sprite
manifest (`assets/sprite-overrides.json` → `"scale": 1.5`). It multiplies how
large the sheet is painted and touches nothing else: not the entity radius, not
the hitbox, not collision, not the wire.

[`04-scale-before-after.png`](04-scale-before-after.png) — before and after at
the sizes the game really paints him, on the arena floor with its own grid
lines, drawn through the shipped `drawSprite()` path in the running game.

| viewport | before | after |
|---|---|---|
| 1440×900 dpr2 | 72 px | **108 px** |
| 1920×1080 dpr1 | 48 px | **72 px** |
| 851×393 dpr2.6 (phone) | 35 px | **53 px** |

### Scale does not move the gate axes — confirmed, not assumed

Measured on the **rendered** pixels rather than the source PNG, since that is
where a scale could plausibly do something:

| | contrast | spread | bodySat | px measured |
|---|---|---|---|---|
| source sheet, S row, 1:1 | 18.0 | 100.8 | 0.334 | 6507 |
| 72 device px at scale 1.0 | 18.1 | 101.9 | 0.337 | 2066 |
| **72 device px at scale 1.5** | **18.2** | **100.5** | **0.336** | 4613 |
| 35 device px at scale 1.0 | 17.5 | 101.1 | 0.336 | 481 |
| **35 device px at scale 1.5** | **19.4** | **97.9** | **0.341** | 1089 |

At desktop size the axes are flat to within 0.1–1.4, which is what nearest-
neighbour magnification should do: it replicates pixels, so a mean over them
does not move.

The phone rows move more (contrast 17.5 → 19.4), and that is **not** the scale
doing work — it is minification. At 35 device px the 128px sheet is reduced to
481 surviving pixels and which ones survive is arbitrary; at 53 px, 1089
survive. The 1.5× figure is the *more* faithful of the two, being closer to the
source sheet's own 18.0. Worth knowing generally: the gate's axes are least
trustworthy at exactly the size the art is hardest to read.

### It costs the fast path, and that is fine here

`drawSprite` normally paints with a bare `drawImage` and no `save()`/`restore()`.
A scale ≠ 1 is a real transform and cannot be expressed that way, so a scaled
sprite takes the slow path by construction. Measured on a 128px sheet at 72
device px, 60 frames × 7 interleaved repeats, medians, headless SwiftShader:

| | ms/frame | µs/draw |
|---|---|---|
| 200 sprites, none scaled | 2.257 | 11.28 |
| 200 sprites, 8 scaled (a full party of Druids) | 2.278 | 11.39 |
| 200 sprites, all 200 scaled | 3.410 | 17.05 |
| 300 sprites, none scaled | 3.352 | 11.17 |
| 300 sprites, 8 scaled | 3.340 | 11.13 |
| 300 sprites, all 300 scaled | 5.062 | 16.87 |

**At horde density the change is unmeasurable**: +0.022 ms at 200 and −0.012 ms
at 300, both inside the run-to-run spread, because only party members carry a
scale and there are at most eight of them. The slow path itself costs about
half again per draw (11.2 → 17.0 µs), covering the transform *and* the 2.25×
pixels a 1.5 sprite fills. Scaling everything would cost 1.7 ms/frame at 300 —
a tenth of the 16.67 ms budget, so even the pathological case is affordable.

The in-game gates are unchanged: 60 fps at the ~300 desktop crest, 60 fps at the
~200 mobile crest.

## 4. Finding the size by eye — `?spritescale` / `?playerscale`

Two URL flags now multiply painted size at render time, so a number can be
settled in a real arena instead of in a manifest. `?spritescale=N` scales every
sprite; `?playerscale=N` scales player sprites only (the `char.` namespace).
They compose with each other and with the manifest's own `scale`. Range
`0 < N <= 8`; absent means 1. Cosmetic, same rule as the manifest key — no
radius, no hitbox, no collision, nothing on the wire.

[`05-size-sweep.png`](05-size-sweep.png) — the Druid at 1.0, 1.5, 2.0 and 2.5
on the real arena floor with the real grid, every cell a crop of an actual game
frame. Three columns: solo, the same frame with the hitbox rings drawn over it,
and the same scale at horde density (210 enemies).

**Viewport 1440x900 @dpr2** — a 2880x1800 device-pixel canvas, **2.25 device px
per world unit**.

| | grid | device px |
|---|---|---|
| **grid square** | 64 world units | **144** |
| hitbox radius | 16 world units | 36 |
| hitbox + enemy shot (r6) | 22 world units | 50 |

| scale | sheet cell | visible silhouette |
|---|---|---|
| 1.0 | 72 px | 70 px |
| 1.5 (shipped) | 108 px | 105 px |
| 2.0 | 144 px | **140 px** |
| 2.5 | 180 px | 174 px |

### One grid square tall

**2.06x** by visible silhouette, **2.00x** by sheet cell. The Druid's art fills
124 of his 128px cell vertically, so the two answers differ by 3%. At 2.0 he
measures 140 px against a 144 px grid square — near enough that the grid reads
as his height, which is the thing Casey was asking for.

### The ceiling: where shots visibly pass through him

The sprite is drawn `2 x radius` across, so the silhouette grows while the
hitbox does not. Measured from the sheet's own opaque bounds (widest row N at
90px, tallest row SW at 124px of a 128 cell):

| | exceeds the hitbox (r16) | exceeds hitbox + shot (r22) |
|---|---|---|
| **height** (124/128) | **1.03x** | **1.42x** |
| **width, front/back** (90/128) | 1.42x | **1.96x** |
| width, profile E/W (53/128) | 2.41x | 3.32x |

Enemy shots are radius 6, so 22 world units is the real catch distance.

- **At the shipped 1.5x** his antlers and boots already sit ~1 world unit past
  the catch radius. Marginal — about 3 device px — and only vertically.
- **Past 2.0x** the gap is wide enough to see: at 2.5 his silhouette is 31
  world units tall against a 22-unit catch radius, so a shot can cross his
  chest-to-head region and miss by 9 units, ~20 device px. That is the point
  where it stops reading as a near miss and starts reading as a bug.
- **The practical ceiling is therefore about 2.0x**, and the binding constraint
  is height, not width. Beyond it the hitbox has to follow the art.

The middle column of the sweep shows this directly: at 1.0 the dashed gold ring
contains him completely; at 2.0 his head and feet are outside it; at 2.5 so is
most of his cloak.

### What size costs at horde density

The third column is the honest tradeoff. Enemies are still primitives (no enemy
art yet), so they read as flat discs — but the occlusion is real. At 1.0 he is
lost among them; at 2.0 he is the clearest thing on screen; at 2.5 he starts
hiding the enemies immediately around him, which is the cost nobody notices
until a shot comes from behind his cloak.

## 5. Where he got smaller — the cell is not the character

Casey saw the Druid shrink between two screenshots with the same crop and the
same grid, during work that only added facings. [`06-where-he-shrank.png`](06-where-he-shrank.png)
reproduces it on the current build with a URL flag, no time travel needed.

**The autocrop did not change.** Measured from the committed sheet at every
commit that touched it:

| commit | UTC | manifest | per-row content | max | cell fill |
|---|---|---|---|---|---|
| `ba42f20` | 08-03 23:16 | `128x128 d4` | 53x122 · 88x118 · 54x123 · 90x118 | 90x123 | 96.1% H, 70.3% W |
| `128540d` | 08-03 23:49 | `128x128 d8` | + 84x122 · 67x124 · 80x121 · 71x121 | 90x124 | 96.9% H, 70.3% W |
| `e690b36` | 08-04 03:56 | `+ scale 1.5` | unchanged | 90x124 | 96.9% H, 70.3% W |

The four cardinal rows are byte-identical across the 4→8 install. The union grew
by one pixel of height because the new SW row is 124 tall. **Width fill is
identical at 70.3%.** Question answered: the eight-facing install did not change
the cell fill, and `--autocrop` is not the cause.

It could not have been, in fact. `--autocrop` crops the sources to their union
bbox and then blits that into the cell **without resampling**, so the figure
occupies the same pixel count whatever the crop box is. A larger union adds
padding; it does not shrink the figure. The tool refuses a crop larger than the
cell rather than scaling to fit.

**Rendered size by commit**, measured off the renderer's own `drawImage` in a
real arena at 1440×900 @dpr2, each commit checked out into its own worktree:

| commit | UTC | on screen | |
|---|---|---|---|
| `928b643` … `c66d897` | 08-03 16:26 → 20:28 | 72.0 px | primitive disc, no art on disk |
| `ba42f20` | 08-03 23:16 | 72.0 px | sprite, cell 128, scale 1 |
| `128540d` | 08-03 23:49 | 72.0 px | sprite, 8 rows |
| `e690b36` | 08-04 03:56 | 108.0 px | scale 1.5 |
| `d706c49` | 08-04 14:00 | 108.0 px | tuning flags, default 1 |

**The cell never shrinks.** It is 72 px from the beginning and only ever goes
up. Which is the point: the cell is not what a player sees.

### The actual mechanism

The primitive was a **filled disc of diameter `2 × radius`** — 72 px, solid,
edge to edge. The sprite is drawn into a box of that same 72 px, but the figure
only fills part of it: the south row is 88×118 of its 128 cell, **68.8% of the
width**.

| | visible width | visible height |
|---|---|---|
| primitive disc | **72.0 px** | 72.0 px |
| sprite, scale 1.0 | **49.5 px** | 66.4 px |
| sprite, scale 1.5 | 74.3 px | 99.6 px |

**Installing the art shrank the character by 31% across, with the cell, the
grid, the camera and the viewport all unchanged.** Every dimension check passed
the whole way through, because every dimension check is about the cell.

That is exactly the cell-versus-content failure — the renderer scales the sheet,
not the figure — it just bit at the primitive→sprite transition rather than at
4→8 facings.

### When it deployed

Two transitions exist in the whole history, and only one is a shrink.

| | deployed (UTC) | effect |
|---|---|---|
| primitive → sprite | **2026-08-04T00:49:03Z** (Pages run #19, `55e10bd`) | **−31% visible width** |
| scale 1.0 → 1.5 | 2026-08-04T11:43:20Z (Pages run #20, `22f11b3`) | +50% |

A 05:00→05:48 local window contains 00:49:03Z for a clock at **UTC+4:30**.
Worth confirming Casey's offset before treating that as settled, but it is the
only shrink there is.

### What this means for the target

Size can move without anyone changing a size — but not on its own, and not
unboundedly. It moves when the *fraction of the cell that is character* changes,
which happens exactly once per asset: when the art replaces the primitive. Any
future character lands the same way, and each one has its own fill fraction, so
"the roster looks inconsistent" is the expected outcome of shipping art, not a
regression.

The fix is to state the target in terms of the thing being looked at. The grid
gives that: **2.0× by cell, 2.06× by silhouette.** Not applied here.

## 6. The gate is still wrong in the same specific, fixable way

Nothing here changes that finding, and nothing in the gate was touched.

[`01-floor-sweep.png`](01-floor-sweep.png) is **unchanged and still applies** —
its rows are the same source art, and adding four facings does not alter how the
figure sits against a floor. Each row is a candidate floor with its own grid
lines, showing the Druid at 72 device px, at 36 device px, a bright projectile
(`#ffd45e`), and a telegraph disc (`rgba(255,93,108,0.28)` fill, `#ff5d6c` edge).
Those were the pre-`scale` sizes; he now paints at 108 and 53. The sweep was not
re-rendered, because magnifying by 1.5 does not change how a colour sits against
a floor — §3 measures exactly that and finds the axes flat.

| floor | | Druid contrast | projectile | telegraph edge |
|---|---|---|---|---|
| `#14161f` | current | 18.0 | 190.4 | 106.3 |
| `#1b1e2b` | grid-line value | 10.0 | 182.3 | 98.2 |
| `#23273a` | | 0.8 | 173.1 | 89.0 |
| `#2b3145` | | **−8.9** | 163.5 | 79.4 |
| `#343b52` | | **−18.9** | 153.4 | 69.4 |
| `#2f2a3d` | cooler | −4.2 | 168.2 | 84.1 |
| `#332f28` | warmer | −7.1 | 165.3 | 81.2 |

**The measured contrast goes negative while the Druid becomes easier to see.**
He reads *better* on `#2b3145` and `#343b52` than on the current floor, because
his dark outline separates from a lighter ground. The number says −18.9.

That is a defect in the metric. The contrast axis computes
`bodyLuma − floorLuma`, a **signed** difference, which silently assumes a sprite
must be lighter than its floor. Readability needs the **absolute** separation. A
dark sprite on a light floor is a normal way to read; the gate cannot currently
express it.

The saturation failure is different and looks real rather than an artifact: 0.39
against a 0.58 band. The Druid's greens and browns genuinely are muted next to
the arcade reference the band was calibrated on. Whether that is a problem
depends on whether the whole game moves to this palette — which is what the
playtest decides, not the gate.

The signed-vs-absolute fix is one line with consequences for every future batch,
and it should follow the playtest rather than pre-empt it.

## 7. The tradeoff a lighter floor buys

Raising the floor helps the Druid and costs the danger layer:

- The **projectile** survives everywhere — gold at luma 212 stays 150+ above any
  of these floors. Not the constraint.
- The **telegraph** is the constraint. Its fill is only 28% alpha, so on
  `#343b52` the filled interior is nearly indistinguishable from the floor and
  the read collapses to the 2px edge ring. A danger zone that only reads as a
  thin outline is a worse trade than a dim Druid.

If the floor moves, the telegraph fill alpha has to move with it. That is a
one-line change in `PALETTE.telegraph` and it is not applied here.

## Open question, for the playtest

Whether a Druid *feels* like a Druid in motion — now with all eight facings, so
turning is a real turn rather than a snap between four. No measurement in this
document answers that, and none of the numbers above should be allowed to
overrule it. Handedness across the profiles is yours to judge in play: the tools
verified row order and angle mapping, not which hand holds the staff.
