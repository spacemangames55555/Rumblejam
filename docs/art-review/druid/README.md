# Druid — installed, measured, and a floor sweep

`assets/sprites/char/toh_druid.png` · sources in [`sources/`](sources/)

## 1. Installed

**Four facings were supplied, not eight** — south, north, east, west. Installed
as a `directions: 4` sheet, which the renderer supports natively: for four
directions the row order is **E S W N**, and `dirIndex()` maps angles onto it
with the same rule it uses for eight. Nothing was invented to fill the gaps.

The remaining four (SE, SW, NW, NE) can be chain-rotated whenever you want them;
not generated, per the instruction to stop.

**Cell size is 128×128, not the declared 32.** The source is **248×248** with
the figure occupying only ~97×124 of it. Declaring 248 would have been
technically correct and visually wrong: the renderer scales the whole *sheet* to
twice the entity radius, not the content, so a figure filling a third of its
canvas renders at a third the size of every other character. `--autocrop` (new)
crops to the union of all content first — 248×248 → 97×124 — and that drops into
a 128 cell with no resampling.

| | |
|---|---|
| file | `assets/sprites/char/toh_druid.png`, 128×512 |
| manifest | `w:128 h:128 directions:4`, via `assets/sprite-overrides.json` |
| rows | 0 E ← `east.png`, 1 S ← `south.png`, 2 W ← `west.png`, 3 N ← `north.png` |
| loader | verified in the running game: `druidLoaded: true`, not in `missing` |

[`00-installed-4rows.png`](00-installed-4rows.png) — the four rows at 2×, then at
36 device px.

## 2. Measured, not gated

Against `#14161f`. **He fails two of three bands.** Installed anyway.

| | contrast (band ≥45) | spread (band ≥90) | bodySat (band ≥0.58) |
|---|---|---|---|
| whole sheet | **22.6** ✗ | 95.3 ✓ | **0.372** ✗ |
| row 0 E | **20.4** ✗ | 102.2 ✓ | **0.393** ✗ |
| row 1 S | **18.0** ✗ | 100.8 ✓ | **0.334** ✗ |
| row 2 W | **16.0** ✗ | 103.5 ✓ | **0.376** ✗ |
| row 3 N | **32.3** ✗ | **80.9** ✗ | **0.391** ✗ |

Facing ratio **0.82** (band ≥0.85) — opposites E/W 133 and S/N 135 against
adjacent 164. Marginal, and expected: with only four facings the "adjacent"
pairs are 90° apart rather than 45°, so they differ more than they would on an
eight-row sheet. The band was calibrated on eight and does not transfer
unchanged to four.

## 3. The gate is wrong in a specific, fixable way

The floor sweep makes it visible. [`01-floor-sweep.png`](01-floor-sweep.png) —
each row is a candidate floor with its own grid lines, showing the Druid at 72
device px, the Druid at 36 device px, a bright projectile (`#ffd45e`), and a
telegraph disc (`rgba(255,93,108,0.28)` fill, `#ff5d6c` edge).

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
Look at the image: he reads *better* on `#2b3145` and `#343b52` than on the
current floor, because his dark outline separates from a lighter ground. The
number says −18.9.

That is a defect in the metric, not in the art. The contrast axis computes
`bodyLuma − floorLuma`, a **signed** difference, which silently assumes a sprite
must be lighter than its floor. What readability actually needs is the
**absolute** separation. A dark sprite on a light floor is a completely normal
way to read; the gate cannot currently express it.

The saturation failure is different and I think it is real rather than an
artifact: 0.37 against a 0.58 band. The Druid's greens and browns genuinely are
muted next to the arcade reference the band was calibrated on. Whether that is a
problem depends entirely on whether the whole game moves to this palette — which
is the thing the playtest decides, not the gate.

**Nothing was changed in the gate.** The signed-vs-absolute fix is a one-line
change with consequences for every future batch, and it should follow the
playtest rather than pre-empt it.

## 4. The tradeoff a lighter floor buys

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

Whether a Druid *feels* like a Druid in motion. No measurement in this document
answers that, and none of the numbers above should be allowed to overrule it.
